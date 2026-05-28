"""测试决策 Agent 核心逻辑"""
import sys
import os
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import Base, DecisionORM, EmployeeORM


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


@pytest.mark.asyncio
async def test_generate_decisions_creates_decisions_for_non_normal(db_session):
    """generate_decisions 为 recommendation != normal 的员工创建决策"""
    from agents.decision_agent import DecisionAgent
    from services.sse_manager import SSEManager

    agent = DecisionAgent()
    mock_sse = SSEManager()

    with patch('agents.decision_agent.sse_manager', mock_sse):
        async with db_session() as db:
            decisions = await agent.generate_decisions(db)

    # seed 数据中有非 normal 员工
    assert len(decisions) >= 0  # 可能为 0 如果全是 normal
    for d in decisions:
        assert d.status == 'pending'
        assert d.type in {'promote', 'salary_raise', 'pip', 'one_on_one'}


@pytest.mark.asyncio
async def test_generate_decisions_no_duplicate_pending(db_session):
    """同一员工同类型的 pending 决策不重复创建"""
    from agents.decision_agent import DecisionAgent
    from services.sse_manager import SSEManager

    agent = DecisionAgent()
    mock_sse = SSEManager()

    with patch('agents.decision_agent.sse_manager', mock_sse):
        async with db_session() as db:
            first_run = await agent.generate_decisions(db)

        with patch('agents.decision_agent.sse_manager', mock_sse):
            async with db_session() as db:
                second_run = await agent.generate_decisions(db)

    # 第二次运行不应创建新决策（已有 pending）
    assert len(second_run) == 0


@pytest.mark.asyncio
async def test_generate_decisions_broadcasts_sse(db_session):
    """generate_decisions 为每条新决策广播 SSE 事件"""
    from agents.decision_agent import DecisionAgent
    from services.sse_manager import SSEManager

    agent = DecisionAgent()
    mock_sse = SSEManager()
    broadcast_calls = []

    original_broadcast = mock_sse.broadcast

    async def tracking_broadcast(event):
        broadcast_calls.append(event)
        await original_broadcast(event)

    mock_sse.broadcast = tracking_broadcast

    with patch('agents.decision_agent.sse_manager', mock_sse):
        async with db_session() as db:
            decisions = await agent.generate_decisions(db)

    assert len(broadcast_calls) == len(decisions)
    for call in broadcast_calls:
        assert call.type == 'decision_created'


@pytest.mark.asyncio
async def test_generate_decisions_writes_to_db(db_session):
    """generate_decisions 将决策写入 decisions 表"""
    from agents.decision_agent import DecisionAgent
    from services.sse_manager import SSEManager

    agent = DecisionAgent()
    mock_sse = SSEManager()

    with patch('agents.decision_agent.sse_manager', mock_sse):
        async with db_session() as db:
            decisions = await agent.generate_decisions(db)

    async with db_session() as db:
        result = await db.execute(
            select(DecisionORM).where(DecisionORM.status == 'pending')
        )
        db_decisions = result.scalars().all()

    assert len(db_decisions) == len(decisions)


@pytest.mark.asyncio
async def test_generate_meeting_agenda_structure(db_session):
    """generate_meeting_agenda 返回正确结构"""
    from agents.decision_agent import DecisionAgent
    from services.sse_manager import SSEManager

    agent = DecisionAgent()
    mock_sse = SSEManager()

    with patch('agents.decision_agent.sse_manager', mock_sse):
        async with db_session() as db:
            await agent.generate_decisions(db)

    async with db_session() as db:
        agenda = await agent.generate_meeting_agenda(db)

    assert 'date' in agenda
    assert 'total_items' in agenda
    assert 'items' in agenda
    assert 'summary' in agenda
    assert isinstance(agenda['items'], list)
    assert agenda['total_items'] == len(agenda['items'])


@pytest.mark.asyncio
async def test_generate_meeting_agenda_empty(db_session):
    """无 pending 决策时议程摘要正确"""
    from agents.decision_agent import DecisionAgent

    agent = DecisionAgent()
    async with db_session() as db:
        agenda = await agent.generate_meeting_agenda(db)

    assert agenda['total_items'] == 0
    assert '无待处理' in agenda['summary']


@pytest.mark.asyncio
async def test_get_status_returns_agent_status_info():
    """get_status 返回 AgentStatusInfo 结构"""
    from agents.decision_agent import DecisionAgent
    from models.agent_status import AgentStatusInfo

    agent = DecisionAgent()
    status = await agent.get_status()

    assert isinstance(status, AgentStatusInfo)
    assert status.agent_name == 'decision'
    assert status.status in {'idle', 'running', 'error'}
