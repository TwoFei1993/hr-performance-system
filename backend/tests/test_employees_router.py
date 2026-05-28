"""员工 API 路由测试"""
import sys
import os

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from services.database import Base, EmployeeORM, get_db
from agents.data_collector import seed_database
from routers.employees import router as employees_router


def _make_test_app(session_factory) -> FastAPI:
    """创建用于测试的 FastAPI 实例，覆盖数据库依赖"""
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(employees_router, prefix="/api")
    return app


@pytest_asyncio.fixture
async def seeded_app():
    """创建已 seed 数据的测试 app"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # seed 数据
    async with session_factory() as db:
        await seed_database(db)

    app = _make_test_app(session_factory)
    yield app
    await engine.dispose()


@pytest.mark.asyncio
async def test_list_employees_returns_paginated(seeded_app: FastAPI):
    """测试 GET /api/employees 返回分页列表"""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=seeded_app), base_url="http://test"
    ) as client:
        response = await client.get("/api/employees?page=1&size=5")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 120
    assert data["page"] == 1
    assert data["size"] == 5
    assert len(data["items"]) == 5


@pytest.mark.asyncio
async def test_list_employees_department_filter(seeded_app: FastAPI):
    """测试 department 筛选"""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=seeded_app), base_url="http://test"
    ) as client:
        response = await client.get("/api/employees?department=研发&size=100")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 30
    for item in data["items"]:
        assert item["department"] == "研发"


@pytest.mark.asyncio
async def test_get_employee_detail(seeded_app: FastAPI):
    """测试 GET /api/employees/{id} 返回详情"""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=seeded_app), base_url="http://test"
    ) as client:
        response = await client.get("/api/employees/EMP0001")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "EMP0001"
    assert "composite_score" in data
    assert "score_history" in data
    assert len(data["score_history"]) == 6


@pytest.mark.asyncio
async def test_get_employee_not_found(seeded_app: FastAPI):
    """测试 404 响应"""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=seeded_app), base_url="http://test"
    ) as client:
        response = await client.get("/api/employees/NOTEXIST")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_stats(seeded_app: FastAPI):
    """测试 GET /api/dashboard/stats 返回正确统计"""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=seeded_app), base_url="http://test"
    ) as client:
        response = await client.get("/api/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_employees"] == 120
    assert "pending_promote" in data
    assert "pending_salary_raise" in data
    assert "pending_pip" in data
    assert "pending_one_on_one" in data
    assert "department_scores" in data
    assert "score_distribution" in data
    # 分数分布应有5个区间
    assert len(data["score_distribution"]) == 5
    # 所有员工都被计入分布
    total_in_dist = sum(r["count"] for r in data["score_distribution"])
    assert total_in_dist == 120
