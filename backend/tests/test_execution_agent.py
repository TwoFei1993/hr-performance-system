"""测试执行 Agent 核心逻辑"""
import sys
import os
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import Base, AgentLogORM, DecisionORM, EmployeeORM


@pytest_asyncio.fixture
async def db_factory():
    """内存数据库 + 已 seed 数据"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        await seed_database(db)
    yield factory
    await engine.dispose()


async def _insert_decision(factory, decision_type: str, employee_id: str = None) -> tuple[str, str]:
    """插入一条 approved 决策，返回 (decision_id, employee_id)"""
    did = str(uuid.uuid4())
    eid = employee_id or str(uuid.uuid4())
    async with factory() as db:
        # 确保员工存在
        result = await db.execute(select(EmployeeORM).limit(1))
        emp = result.scalar_one_or_none()
        if emp is None:
            db.add(EmployeeORM(
                id=eid, name="测试员工", department="研发", level="P5",
                manager="张总", hire_date="2020-01-01",
                okr_score=80.0, review_score_360=80.0, business_score=80.0,
                attendance_score=80.0, composite_score=80.0,
                score_history="[80,80,80,80,80,80]",
                trend="stable", recommendation="normal",
                recommendation_reason="正常", confidence=0.9,
            ))
            await db.commit()
        else:
            eid = emp.id

        db.add(DecisionORM(
            id=did, employee_id=eid, employee_name="测试员工",
            department="研发", type=decision_type, status="approved",
            reason="测试原因", confidence=0.9,
            created_at="2026-05-28T00:00:00+00:00",
            resolved_at="2026-05-28T01:00:00+00:00",
        ))
        await db.commit()
    return did, eid


@pytest.mark.asyncio
async def test_execute_promote_updates_level(db_factory):
    """execute_decision promote → 员工 level 升级"""
    from agents.execution_agent import ExecutionAgent
    from models.decision import Decision
    from services.sse_manager import SSEManager

    agent = ExecutionAgent()
    mock_sse = SSEManager()

    # 获取一个 P5 员工
    async with db_factory() as db:
        result = await db.execute(
            select(EmployeeORM).where(EmployeeORM.level == 'P5').limit(1)
        )
        emp = result.scalar_one_or_none()

    if emp is None:
        pytest.skip("没有 P5 员工可测试")

    decision = Decision(
        id=str(uuid.uuid4()), employee_id=emp.id, employee_name=emp.name,
        department=emp.department, type='promote', status='approved',
        reason='测试晋升', confidence=0.9,
        created_at="2026-05-28T00:00:00+00:00",
    )

    with patch('agents.execution_agent.sse_manager', mock_sse):
        async with db_factory() as db:
            result_msg = await agent.execute_decision(decision, db)

    assert 'P6' in result_msg or 'P5' in result_msg  # 升级或已是最高级
    assert emp.name in result_msg

    # 验证数据库已更新
    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).where(EmployeeORM.id == emp.id))
        updated_emp = result.scalar_one()
    assert updated_emp.level == 'P6'


@pytest.mark.asyncio
async def test_execute_salary_raise_writes_log(db_factory):
    """execute_decision salary_raise → agent_logs 有记录"""
    from agents.execution_agent import ExecutionAgent
    from models.decision import Decision
    from services.sse_manager import SSEManager

    agent = ExecutionAgent()
    mock_sse = SSEManager()

    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).limit(1))
        emp = result.scalar_one()

    decision = Decision(
        id=str(uuid.uuid4()), employee_id=emp.id, employee_name=emp.name,
        department=emp.department, type='salary_raise', status='approved',
        reason='测试调薪', confidence=0.9,
        created_at="2026-05-28T00:00:00+00:00",
    )

    with patch('agents.execution_agent.sse_manager', mock_sse):
        async with db_factory() as db:
            result_msg = await agent.execute_decision(decision, db)

    assert '+10%' in result_msg

    async with db_factory() as db:
        log_result = await db.execute(
            select(AgentLogORM).where(AgentLogORM.action == 'salary_raise')
        )
        logs = log_result.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_execute_pip_updates_recommendation(db_factory):
    """execute_decision pip → 员工 recommendation 更新为 pip"""
    from agents.execution_agent import ExecutionAgent
    from models.decision import Decision
    from services.sse_manager import SSEManager

    agent = ExecutionAgent()
    mock_sse = SSEManager()

    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).limit(1))
        emp = result.scalar_one()

    decision = Decision(
        id=str(uuid.uuid4()), employee_id=emp.id, employee_name=emp.name,
        department=emp.department, type='pip', status='approved',
        reason='测试PIP', confidence=0.9,
        created_at="2026-05-28T00:00:00+00:00",
    )

    with patch('agents.execution_agent.sse_manager', mock_sse):
        async with db_factory() as db:
            result_msg = await agent.execute_decision(decision, db)

    assert 'PIP' in result_msg

    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).where(EmployeeORM.id == emp.id))
        updated_emp = result.scalar_one()
    assert updated_emp.recommendation == 'pip'


@pytest.mark.asyncio
async def test_execute_one_on_one_writes_log(db_factory):
    """execute_decision one_on_one → agent_logs 有记录"""
    from agents.execution_agent import ExecutionAgent
    from models.decision import Decision
    from services.sse_manager import SSEManager

    agent = ExecutionAgent()
    mock_sse = SSEManager()

    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).limit(1))
        emp = result.scalar_one()

    decision = Decision(
        id=str(uuid.uuid4()), employee_id=emp.id, employee_name=emp.name,
        department=emp.department, type='one_on_one', status='approved',
        reason='测试1对1', confidence=0.9,
        created_at="2026-05-28T00:00:00+00:00",
    )

    with patch('agents.execution_agent.sse_manager', mock_sse):
        async with db_factory() as db:
            result_msg = await agent.execute_decision(decision, db)

    assert '日历' in result_msg

    async with db_factory() as db:
        log_result = await db.execute(
            select(AgentLogORM).where(AgentLogORM.action == 'one_on_one')
        )
        logs = log_result.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_batch_execute_multiple_decisions(db_factory):
    """batch_execute 批量执行多个决策"""
    from agents.execution_agent import ExecutionAgent
    from services.sse_manager import SSEManager

    agent = ExecutionAgent()
    mock_sse = SSEManager()

    # 插入两条 approved 决策
    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).limit(2))
        emps = result.scalars().all()

    if len(emps) < 2:
        pytest.skip("需要至少2名员工")

    decision_ids = []
    async with db_factory() as db:
        for emp in emps[:2]:
            did = str(uuid.uuid4())
            db.add(DecisionORM(
                id=did, employee_id=emp.id, employee_name=emp.name,
                department=emp.department, type='one_on_one', status='approved',
                reason='批量测试', confidence=0.9,
                created_at="2026-05-28T00:00:00+00:00",
            ))
            decision_ids.append(did)
        await db.commit()

    with patch('agents.execution_agent.sse_manager', mock_sse):
        async with db_factory() as db:
            results = await agent.batch_execute(decision_ids, db)

    assert len(results) == 2
    for r in results:
        assert 'decision_id' in r
        assert 'success' in r
        assert 'message' in r


@pytest.mark.asyncio
async def test_execute_decision_broadcasts_sse(db_factory):
    """execute_decision 广播 SSE 事件"""
    from agents.execution_agent import ExecutionAgent
    from models.decision import Decision
    from services.sse_manager import SSEManager

    agent = ExecutionAgent()
    mock_sse = SSEManager()
    broadcast_calls = []

    original_broadcast = mock_sse.broadcast

    async def tracking_broadcast(event):
        broadcast_calls.append(event)
        await original_broadcast(event)

    mock_sse.broadcast = tracking_broadcast

    async with db_factory() as db:
        result = await db.execute(select(EmployeeORM).limit(1))
        emp = result.scalar_one()

    decision = Decision(
        id=str(uuid.uuid4()), employee_id=emp.id, employee_name=emp.name,
        department=emp.department, type='one_on_one', status='approved',
        reason='SSE测试', confidence=0.9,
        created_at="2026-05-28T00:00:00+00:00",
    )

    with patch('agents.execution_agent.sse_manager', mock_sse):
        async with db_factory() as db:
            await agent.execute_decision(decision, db)

    assert len(broadcast_calls) == 1
    assert broadcast_calls[0].type == 'decision_updated'


@pytest.mark.asyncio
async def test_get_status_returns_agent_status_info():
    """get_status 返回 AgentStatusInfo 结构"""
    from agents.execution_agent import ExecutionAgent
    from models.agent_status import AgentStatusInfo

    agent = ExecutionAgent()
    status = await agent.get_status()

    assert isinstance(status, AgentStatusInfo)
    assert status.agent_name == 'execution'
    assert status.status in {'idle', 'running', 'error'}
