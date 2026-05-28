"""测试报告查询路由"""
import sys
import os
import uuid
import json

import pytest
import pytest_asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.data_collector import seed_database
from services.database import Base, ReportORM, get_db
from routers.reports import router as reports_router


def _make_test_app(session_factory) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(reports_router, prefix="/api")
    return app


async def _insert_report(factory, report_type: str = 'daily') -> str:
    """插入一条报告，返回 id"""
    rid = str(uuid.uuid4())
    async with factory() as db:
        db.add(ReportORM(
            id=rid,
            type=report_type,
            generated_at="2026-05-28T00:00:00+00:00",
            summary="测试报告摘要",
            content=json.dumps({"test": "data"}),
            employee_count=120,
            decision_count=5,
        ))
        await db.commit()
    return rid


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
async def test_get_daily_report_returns_latest(app_factory):
    """GET /api/reports/daily 返回最新日报"""
    app, factory = app_factory
    await _insert_report(factory, 'daily')

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/reports/daily")

    assert response.status_code == 200
    data = response.json()
    assert data['type'] == 'daily'
    assert 'summary' in data
    assert 'generated_at' in data
    assert 'employee_count' in data


@pytest.mark.asyncio
async def test_get_daily_report_returns_404_when_none(app_factory):
    """无日报时返回 404"""
    app, _ = app_factory

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/reports/daily")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_weekly_report_returns_404_when_none(app_factory):
    """无周报时返回 404"""
    app, _ = app_factory

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/reports/weekly")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_reports_returns_paginated(app_factory):
    """GET /api/reports/list 返回分页列表"""
    app, factory = app_factory
    for t in ['daily', 'weekly', 'monthly']:
        await _insert_report(factory, t)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/reports/list")

    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    assert 'total' in data
    assert 'page' in data
    assert 'size' in data
    assert data['total'] >= 3


@pytest.mark.asyncio
async def test_list_reports_filter_by_type(app_factory):
    """GET /api/reports/list 支持 type 筛选"""
    app, factory = app_factory
    await _insert_report(factory, 'daily')
    await _insert_report(factory, 'weekly')

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/reports/list?type=daily")

    assert response.status_code == 200
    data = response.json()
    for item in data['items']:
        assert item['type'] == 'daily'


@pytest.mark.asyncio
async def test_list_reports_pagination(app_factory):
    """GET /api/reports/list 分页参数生效"""
    app, factory = app_factory
    for _ in range(5):
        await _insert_report(factory, 'daily')

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/reports/list?page=1&size=2")

    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) <= 2
    assert data['page'] == 1
    assert data['size'] == 2
