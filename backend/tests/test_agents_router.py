"""测试 Agent 状态与触发路由"""
import json
import sys
import os
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import AgentLogORM, Base, get_db
from routers.agents import router as agents_router


def _make_test_app(session_factory) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(agents_router, prefix="/api")
    return app


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
async def test_get_agents_status_returns_four_agents(seeded_app):
    """GET /api/agents/status 返回4个 Agent 状态"""
    app, _ = seeded_app
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/agents/status")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4
    names = {item['agent_name'] for item in data}
    assert 'analysis' in names
    assert 'data_collector' in names
    assert 'decision' in names
    assert 'execution' in names


@pytest.mark.asyncio
async def test_trigger_analysis_returns_202(seeded_app):
    """POST /api/agents/trigger 返回 202"""
    app, _ = seeded_app

    # mock 后台任务，避免真实执行
    with patch('routers.agents._run_analysis_background', new_callable=AsyncMock):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/agents/trigger",
                json={"agent": "analysis", "scope": "daily"},
            )

    assert response.status_code == 202
    data = response.json()
    assert data['agent'] == 'analysis'
    assert data['scope'] == 'daily'


@pytest.mark.asyncio
async def test_trigger_placeholder_agent_returns_202(seeded_app):
    """触发未实现的 Agent 也返回 202"""
    app, _ = seeded_app
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/agents/trigger",
            json={"agent": "data_collector", "scope": "daily"},
        )

    assert response.status_code == 202


@pytest.mark.asyncio
async def test_trigger_analysis_writes_agent_log(seeded_app):
    """触发分析后 agent_logs 有记录（真实执行，mock MiniMax）"""
    app, factory = seeded_app

    from agents.analysis_agent import AnalysisAgent
    from services.rule_engine import AnalysisResult

    async def fake_analyze(emp):
        return AnalysisResult(
            employee_id=emp.id,
            recommendation='normal',
            reason='测试',
            confidence=0.75,
            is_ai_degraded=True,
        )

    # 直接调用 agent，绕过后台任务
    agent = AnalysisAgent()
    with patch.object(agent._client, 'analyze_employee', side_effect=fake_analyze):
        async with factory() as db:
            await agent.run_analysis('daily', db)

    async with factory() as db:
        result = await db.execute(
            select(AgentLogORM).where(AgentLogORM.agent_name == 'analysis')
        )
        logs = result.scalars().all()

    assert len(logs) >= 1
