"""测试月会流程路由"""
import sys
import os
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import Base, DecisionORM, EmployeeORM, get_db
from routers.monthly_meeting import router as meeting_router


def _make_test_app(session_factory) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(meeting_router, prefix="/api")
    return app


async def _insert_pending_decisions(factory, count: int = 2) -> list[str]:
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
                reason='路由测试', confidence=0.9,
                created_at="2026-05-28T00:00:00+00:00",
            ))
            ids.append(did)
        await db.commit()
    return ids


@pytest_asyncio.fixture
async def app_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        await seed_database(db)
    app = _make_test_app(factory)
    yield app, factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_agenda_returns_404_when_no_meeting(app_factory):
    """无进行中月会时 GET agenda 返回 404"""
    from services.monthly_meeting import monthly_meeting_service
    # 确保没有进行中的月会
    monthly_meeting_service._current_agenda = None

    app, _ = app_factory
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/monthly-meeting/agenda")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_start_meeting_returns_agenda(app_factory):
    """POST /api/monthly-meeting/start 返回结构化议程"""
    from services.monthly_meeting import monthly_meeting_service
    from services.sse_manager import SSEManager

    monthly_meeting_service._current_agenda = None
    app, factory = app_factory
    await _insert_pending_decisions(factory, 2)

    mock_sse = SSEManager()
    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/api/monthly-meeting/start")

    assert response.status_code == 201
    data = response.json()
    assert 'id' in data
    assert 'date' in data
    assert 'total_items' in data
    assert 'items' in data
    assert 'summary' in data
    assert data['status'] == 'in_progress'
    assert data['total_items'] >= 2


@pytest.mark.asyncio
async def test_get_agenda_returns_current_meeting(app_factory):
    """启动月会后 GET agenda 返回当前议程"""
    from services.monthly_meeting import monthly_meeting_service
    from services.sse_manager import SSEManager

    monthly_meeting_service._current_agenda = None
    app, factory = app_factory
    await _insert_pending_decisions(factory, 1)

    mock_sse = SSEManager()
    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            start_resp = await client.post("/api/monthly-meeting/start")
            agenda_resp = await client.get("/api/monthly-meeting/agenda")

    assert agenda_resp.status_code == 200
    data = agenda_resp.json()
    assert data['id'] == start_resp.json()['id']


@pytest.mark.asyncio
async def test_confirm_item_updates_agenda(app_factory):
    """POST /api/monthly-meeting/confirm 更新议程项确认状态"""
    from services.monthly_meeting import monthly_meeting_service
    from services.sse_manager import SSEManager

    monthly_meeting_service._current_agenda = None
    app, factory = app_factory
    ids = await _insert_pending_decisions(factory, 2)

    mock_sse = SSEManager()
    with patch('services.monthly_meeting.sse_manager', mock_sse):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            start_resp = await client.post("/api/monthly-meeting/start")
            agenda = start_resp.json()
            first_id = agenda['items'][0]['decision']['id']

            confirm_resp = await client.post(
                "/api/monthly-meeting/confirm",
                json={"decision_id": first_id, "confirmed": True},
            )

    assert confirm_resp.status_code == 200
    item = confirm_resp.json()
    assert item['confirmed'] is True
    assert item['decision']['id'] == first_id


@pytest.mark.asyncio
async def test_full_meeting_flow(app_factory):
    """完整月会流程：start → confirm → finish"""
    from services.monthly_meeting import monthly_meeting_service
    from services.sse_manager import SSEManager

    monthly_meeting_service._current_agenda = None
    app, factory = app_factory
    await _insert_pending_decisions(factory, 2)

    mock_sse = SSEManager()
    with patch('services.monthly_meeting.sse_manager', mock_sse):
        with patch('agents.execution_agent.sse_manager', mock_sse):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                # 1. 启动月会
                start_resp = await client.post("/api/monthly-meeting/start")
                assert start_resp.status_code == 201
                agenda = start_resp.json()

                # 2. 确认所有议程项
                for item in agenda['items']:
                    confirm_resp = await client.post(
                        "/api/monthly-meeting/confirm",
                        json={"decision_id": item['decision']['id'], "confirmed": True},
                    )
                    assert confirm_resp.status_code == 200

                # 3. 结束月会
                finish_resp = await client.post("/api/monthly-meeting/finish")

    assert finish_resp.status_code == 200
    minutes = finish_resp.json()
    assert 'id' in minutes
    assert 'date' in minutes
    assert 'total_decisions' in minutes
    assert 'approved_count' in minutes
    assert 'rejected_count' in minutes
    assert 'execution_results' in minutes
    assert minutes['approved_count'] == len(agenda['items'])


@pytest.mark.asyncio
async def test_finish_meeting_without_start_returns_400(app_factory):
    """无进行中月会时 finish 返回 400"""
    from services.monthly_meeting import monthly_meeting_service

    monthly_meeting_service._current_agenda = None
    app, _ = app_factory

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/monthly-meeting/finish")

    assert response.status_code == 400
