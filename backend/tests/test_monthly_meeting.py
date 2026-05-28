"""测试月会业务逻辑服务"""
import sys
import os
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import Base, DecisionORM, EmployeeORM


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


async def _insert_pending_decisions(factory, count: int = 3) -> list[str]:
    """插入若干 pending 决策，返回 id 列表"""
    ids = []
    async with factory() as db:
        result = await db.execute(select(EmployeeORM).limit(count))
        emps = result.scalars().all()
        for emp in emps:
            did = str(uuid.uuid4())
            db.add(DecisionORM(
                id=did, employee_id=emp.id, employee_name=emp.name,
                department=emp.department, type='one_on_one', status='pending',
                reason='月会测试', confidence=0.9,
                created_at="2026-05-28T00:00:00+00:00",
            ))
            ids.append(did)
        await db.commit()
    return ids


@pytest.mark.asyncio
async def test_start_meeting_collects_pending_decisions(db_factory):
    """start_meeting 汇总所有 pending 决策"""
    from services.monthly_meeting import MonthlyMeetingService
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()
    ids = await _insert_pending_decisions(db_factory, 3)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            agenda = await service.start_meeting(db)

    assert agenda.total_items >= 3
    assert len(agenda.items) == agenda.total_items
    assert agenda.status == 'in_progress'
    assert agenda.id is not None
    assert agenda.date is not None
    assert '月会' in agenda.summary or '事项' in agenda.summary


@pytest.mark.asyncio
async def test_start_meeting_empty_returns_empty_agenda(db_factory):
    """无 pending 决策时议程为空"""
    from services.monthly_meeting import MonthlyMeetingService
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            agenda = await service.start_meeting(db)

    assert agenda.total_items == 0
    assert '无待处理' in agenda.summary


@pytest.mark.asyncio
async def test_confirm_item_updates_confirmed_flag(db_factory):
    """confirm_item 逐条确认议程项"""
    from services.monthly_meeting import MonthlyMeetingService
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()
    ids = await _insert_pending_decisions(db_factory, 2)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            agenda = await service.start_meeting(db)

    # 确认第一项
    first_id = agenda.items[0].decision.id
    async with db_factory() as db:
        item = await service.confirm_item(first_id, True, db)

    assert item.confirmed is True
    assert item.decision.id == first_id

    # 驳回第二项
    second_id = agenda.items[1].decision.id
    async with db_factory() as db:
        item2 = await service.confirm_item(second_id, False, db)

    assert item2.confirmed is False


@pytest.mark.asyncio
async def test_confirm_item_nonexistent_raises_error(db_factory):
    """确认不存在的议程项抛出 ValueError"""
    from services.monthly_meeting import MonthlyMeetingService
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()
    await _insert_pending_decisions(db_factory, 1)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            await service.start_meeting(db)

    with pytest.raises(ValueError, match="不存在"):
        async with db_factory() as db:
            await service.confirm_item("nonexistent-id", True, db)


@pytest.mark.asyncio
async def test_finish_meeting_executes_confirmed_items(db_factory):
    """finish_meeting 批量执行确认项并生成纪要"""
    from services.monthly_meeting import MonthlyMeetingService
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()
    ids = await _insert_pending_decisions(db_factory, 3)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            agenda = await service.start_meeting(db)

    # 确认前两项，驳回第三项
    for item in agenda.items[:2]:
        async with db_factory() as db:
            await service.confirm_item(item.decision.id, True, db)
    if len(agenda.items) >= 3:
        async with db_factory() as db:
            await service.confirm_item(agenda.items[2].decision.id, False, db)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        with patch('agents.execution_agent.sse_manager', mock_sse):
            async with db_factory() as db:
                minutes = await service.finish_meeting(db)

    assert minutes.approved_count == 2
    assert minutes.total_decisions >= 3
    assert minutes.generated_at is not None
    assert isinstance(minutes.execution_results, list)


@pytest.mark.asyncio
async def test_finish_meeting_clears_current_agenda(db_factory):
    """finish_meeting 后当前议程被清空"""
    from services.monthly_meeting import MonthlyMeetingService
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()
    await _insert_pending_decisions(db_factory, 1)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            await service.start_meeting(db)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        with patch('agents.execution_agent.sse_manager', mock_sse):
            async with db_factory() as db:
                await service.finish_meeting(db)

    agenda = await service.get_current_agenda()
    assert agenda is None


@pytest.mark.asyncio
async def test_minutes_structure_is_correct(db_factory):
    """纪要结构正确（含统计数字）"""
    from services.monthly_meeting import MonthlyMeetingService, MeetingMinutes
    from services.sse_manager import SSEManager

    service = MonthlyMeetingService()
    mock_sse = SSEManager()
    await _insert_pending_decisions(db_factory, 2)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with db_factory() as db:
            agenda = await service.start_meeting(db)

    for item in agenda.items:
        async with db_factory() as db:
            await service.confirm_item(item.decision.id, True, db)

    with patch('services.monthly_meeting.sse_manager', mock_sse):
        with patch('agents.execution_agent.sse_manager', mock_sse):
            async with db_factory() as db:
                minutes = await service.finish_meeting(db)

    assert isinstance(minutes, MeetingMinutes)
    assert minutes.id is not None
    assert minutes.date is not None
    assert minutes.total_decisions == minutes.approved_count + minutes.rejected_count + minutes.deferred_count
    assert isinstance(minutes.decisions, list)
    assert isinstance(minutes.execution_results, list)
