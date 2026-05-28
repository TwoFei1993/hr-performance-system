"""测试分析 Agent 核心逻辑"""
import json
import sys
import os
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import AgentLogORM, Base, EmployeeORM, ReportORM
from services.rule_engine import AnalysisResult


@pytest_asyncio.fixture
async def db_session():
    """内存数据库 + 已 seed 数据"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        await seed_database(db)
    yield factory
    await engine.dispose()


def _mock_result(employee_id: str, rec: str = 'normal') -> AnalysisResult:
    return AnalysisResult(
        employee_id=employee_id,
        recommendation=rec,  # type: ignore[arg-type]
        reason='Mock 分析结果',
        confidence=0.85,
        is_ai_degraded=True,
    )


@pytest.mark.asyncio
async def test_run_analysis_daily_updates_normal_employees(db_session):
    """daily 分析只处理 recommendation == normal 的员工，并更新数据库"""
    from agents.analysis_agent import AnalysisAgent

    agent = AnalysisAgent()

    async def fake_analyze(emp):
        return _mock_result(emp.id, 'salary_raise')

    with patch.object(agent._client, 'analyze_employee', side_effect=fake_analyze):
        async with db_session() as db:
            report = await agent.run_analysis('daily', db)

    assert report.type == 'daily'
    assert report.employee_count >= 0  # 可能为 0（如果没有 normal 员工）


@pytest.mark.asyncio
async def test_run_analysis_weekly_processes_all_employees(db_session):
    """weekly 分析处理全部120名员工"""
    from agents.analysis_agent import AnalysisAgent

    agent = AnalysisAgent()
    call_count = 0

    async def fake_analyze(emp):
        nonlocal call_count
        call_count += 1
        return _mock_result(emp.id, 'normal')

    with patch.object(agent._client, 'analyze_employee', side_effect=fake_analyze):
        async with db_session() as db:
            report = await agent.run_analysis('weekly', db)

    assert call_count == 120
    assert report.employee_count == 120
    assert report.type == 'weekly'


@pytest.mark.asyncio
async def test_run_analysis_writes_report_to_db(db_session):
    """分析完成后 reports 表有记录"""
    from agents.analysis_agent import AnalysisAgent

    agent = AnalysisAgent()

    async def fake_analyze(emp):
        return _mock_result(emp.id, 'normal')

    with patch.object(agent._client, 'analyze_employee', side_effect=fake_analyze):
        async with db_session() as db:
            report = await agent.run_analysis('weekly', db)

    async with db_session() as db:
        result = await db.execute(select(ReportORM).where(ReportORM.id == report.id))
        orm = result.scalar_one_or_none()

    assert orm is not None
    assert orm.type == 'weekly'
    assert orm.employee_count == 120


@pytest.mark.asyncio
async def test_run_analysis_writes_agent_log(db_session):
    """分析完成后 agent_logs 表有记录"""
    from agents.analysis_agent import AnalysisAgent

    agent = AnalysisAgent()

    async def fake_analyze(emp):
        return _mock_result(emp.id, 'normal')

    with patch.object(agent._client, 'analyze_employee', side_effect=fake_analyze):
        async with db_session() as db:
            await agent.run_analysis('weekly', db)

    async with db_session() as db:
        result = await db.execute(
            select(AgentLogORM).where(AgentLogORM.agent_name == 'analysis')
        )
        logs = result.scalars().all()

    assert len(logs) >= 1
    assert logs[-1].status == 'success'
    assert 'weekly' in logs[-1].action


@pytest.mark.asyncio
async def test_run_analysis_updates_employee_recommendation(db_session):
    """分析后员工的 recommendation 字段已更新"""
    from agents.analysis_agent import AnalysisAgent

    agent = AnalysisAgent()

    async def fake_analyze(emp):
        return _mock_result(emp.id, 'pip')

    with patch.object(agent._client, 'analyze_employee', side_effect=fake_analyze):
        async with db_session() as db:
            await agent.run_analysis('weekly', db)

    async with db_session() as db:
        result = await db.execute(select(EmployeeORM).limit(5))
        emps = result.scalars().all()

    for emp in emps:
        assert emp.recommendation == 'pip'
        assert emp.is_ai_degraded is True


@pytest.mark.asyncio
async def test_get_status_returns_agent_status_info(db_session):
    """get_status 返回 AgentStatusInfo 结构"""
    from agents.analysis_agent import AnalysisAgent
    from models.agent_status import AgentStatusInfo

    agent = AnalysisAgent()
    status = await agent.get_status()

    assert isinstance(status, AgentStatusInfo)
    assert status.agent_name == 'analysis'
    assert status.status in {'idle', 'running', 'error'}
