"""测试决策审批路由"""
import sys
import os
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import Base, DecisionORM, get_db
from routers.decisions import router as decisions_router


def _make_test_app(session_factory) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(decisions_router, prefix="/api")
    return app


async def _insert_pending_decision(factory, decision_id: str = None) -> str:
    """向数据库插入一条 pending 决策，返回 id"""
    did = decision_id or str(uuid.uuid4())
    async with factory() as db:
        db.add(DecisionORM(
            id=did,
            employee_id="emp-001",
            employee_name="测试员工",
            department="研发",
            type="promote",
            status="pending",
            reason="测试原因",
            confidence=0.9,
            created_at="2026-05-28T00:00:00+00:00",
        ))
        await db.commit()
    return did


@pytest_asyncio.fixture
async def seeded_app():
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
async def test_get_pending_decisions_returns_list(seeded_app):
    """GET /api/decisions/pending 返回列表结构"""
    app, factory = seeded_app
    await _insert_pending_decision(factory)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/decisions/pending")

    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    assert 'total' in data
    assert 'page' in data
    assert 'size' in data
    assert data['total'] >= 1


@pytest.mark.asyncio
async def test_get_pending_decisions_pagination(seeded_app):
    """GET /api/decisions/pending 支持分页参数"""
    app, factory = seeded_app
    for _ in range(5):
        await _insert_pending_decision(factory)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/decisions/pending?page=1&size=2")

    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) <= 2
    assert data['page'] == 1
    assert data['size'] == 2


@pytest.mark.asyncio
async def test_approve_decision_updates_status(seeded_app):
    """POST /api/decisions/{id}/approve 更新状态为 approved"""
    app, factory = seeded_app
    did = await _insert_pending_decision(factory)

    with patch('routers.decisions.sse_manager') as mock_sse:
        mock_sse.broadcast = AsyncMock()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/decisions/{did}/approve",
                json={"resolved_by": "总经理"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'approved'
    assert data['resolved_by'] == '总经理'
    assert data['resolved_at'] is not None


@pytest.mark.asyncio
async def test_approve_decision_broadcasts_sse(seeded_app):
    """POST approve 触发 SSE 广播"""
    app, factory = seeded_app
    did = await _insert_pending_decision(factory)

    with patch('routers.decisions.sse_manager') as mock_sse:
        mock_sse.broadcast = AsyncMock()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            await client.post(f"/api/decisions/{did}/approve", json={})

    mock_sse.broadcast.assert_called_once()
    event = mock_sse.broadcast.call_args[0][0]
    assert event.type == 'decision_updated'


@pytest.mark.asyncio
async def test_reject_decision_updates_status(seeded_app):
    """POST /api/decisions/{id}/reject 更新状态为 rejected"""
    app, factory = seeded_app
    did = await _insert_pending_decision(factory)

    with patch('routers.decisions.sse_manager') as mock_sse:
        mock_sse.broadcast = AsyncMock()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(f"/api/decisions/{did}/reject")

    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'rejected'


@pytest.mark.asyncio
async def test_defer_decision_updates_status(seeded_app):
    """POST /api/decisions/{id}/defer 更新状态为 deferred"""
    app, factory = seeded_app
    did = await _insert_pending_decision(factory)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(f"/api/decisions/{did}/defer")

    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'deferred'


@pytest.mark.asyncio
async def test_approve_nonexistent_decision_returns_404(seeded_app):
    """审批不存在的决策返回 404"""
    app, _ = seeded_app
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/decisions/nonexistent/approve", json={})

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_decision_history_returns_resolved(seeded_app):
    """GET /api/decisions/history 返回已处理决策"""
    app, factory = seeded_app
    did = await _insert_pending_decision(factory)

    with patch('routers.decisions.sse_manager') as mock_sse:
        mock_sse.broadcast = AsyncMock()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            await client.post(f"/api/decisions/{did}/approve", json={})
            response = await client.get("/api/decisions/history")

    assert response.status_code == 200
    data = response.json()
    assert data['total'] >= 1
    statuses = {item['status'] for item in data['items']}
    assert 'pending' not in statuses
