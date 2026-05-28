"""数据库层测试"""
import json
import sys
import os

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from services.database import Base, EmployeeORM


@pytest_asyncio.fixture
async def db_session():
    """使用内存 SQLite 创建测试用 AsyncSession"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_init_db_creates_tables(db_session: AsyncSession):
    """测试 init_db 创建表成功"""
    result = await db_session.execute(
        text("SELECT name FROM sqlite_master WHERE type='table'")
    )
    tables = {row[0] for row in result.fetchall()}
    assert "employees" in tables
    assert "decisions" in tables
    assert "reports" in tables
    assert "agent_logs" in tables


@pytest.mark.asyncio
async def test_insert_and_query_employee(db_session: AsyncSession):
    """测试插入员工记录并查询"""
    emp = EmployeeORM(
        id="EMP0001",
        name="张伟",
        department="研发",
        level="P6",
        manager="王总",
        hire_date="2020-01-01",
        okr_score=75.0,
        review_score_360=80.0,
        business_score=70.0,
        attendance_score=90.0,
        composite_score=76.25,
        score_history=json.dumps([70.0, 72.0, 74.0, 76.0, 78.0, 76.25]),
        trend="up",
        recommendation="normal",
        recommendation_reason="表现正常",
        confidence=0.75,
        is_ai_degraded=False,
    )
    db_session.add(emp)
    await db_session.commit()

    result = await db_session.execute(
        select(EmployeeORM).where(EmployeeORM.id == "EMP0001")
    )
    fetched = result.scalar_one()
    assert fetched.name == "张伟"
    assert fetched.department == "研发"
    assert fetched.composite_score == pytest.approx(76.25)


@pytest.mark.asyncio
async def test_update_employee(db_session: AsyncSession):
    """测试更新员工记录"""
    emp = EmployeeORM(
        id="EMP0002",
        name="李芳",
        department="销售",
        level="P5",
        manager="陈总",
        hire_date="2021-06-01",
        okr_score=60.0,
        review_score_360=65.0,
        business_score=55.0,
        attendance_score=80.0,
        composite_score=62.75,
        score_history=json.dumps([60.0, 61.0, 62.0, 63.0, 62.0, 62.75]),
        trend="stable",
        recommendation="normal",
        recommendation_reason="表现正常",
        confidence=0.75,
        is_ai_degraded=False,
    )
    db_session.add(emp)
    await db_session.commit()

    emp.composite_score = 85.0
    emp.recommendation = "salary_raise"
    await db_session.commit()

    result = await db_session.execute(
        select(EmployeeORM).where(EmployeeORM.id == "EMP0002")
    )
    updated = result.scalar_one()
    assert updated.composite_score == pytest.approx(85.0)
    assert updated.recommendation == "salary_raise"
