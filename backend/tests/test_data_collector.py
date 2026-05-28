"""数据采集 Agent 测试"""
import sys
import os

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from services.database import Base, EmployeeORM
from agents.data_collector import (
    generate_mock_employees,
    seed_database,
    _calc_composite,
    DEPT_CONFIG,
)


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


def test_generate_120_employees():
    """测试生成120名员工"""
    employees = generate_mock_employees()
    assert len(employees) == 120


def test_department_distribution():
    """测试部门分布正确"""
    employees = generate_mock_employees()
    dept_counts: dict[str, int] = {}
    for emp in employees:
        dept_counts[emp.department] = dept_counts.get(emp.department, 0) + 1

    expected = {dept: count for dept, count, _ in DEPT_CONFIG}
    for dept, expected_count in expected.items():
        assert dept_counts.get(dept, 0) == expected_count, (
            f"部门 {dept} 期望 {expected_count} 人，实际 {dept_counts.get(dept, 0)} 人"
        )


def test_composite_score_formula():
    """测试 composite_score 计算公式正确"""
    okr, r360, biz, att = 80.0, 70.0, 90.0, 60.0
    expected = okr * 0.3 + r360 * 0.25 + biz * 0.3 + att * 0.15
    assert _calc_composite(okr, r360, biz, att) == pytest.approx(expected)


def test_composite_score_in_employees():
    """测试生成员工的 composite_score 与公式一致"""
    employees = generate_mock_employees()
    for emp in employees:
        expected = _calc_composite(
            emp.okr_score, emp.review_score_360,
            emp.business_score, emp.attendance_score,
        )
        assert emp.composite_score == pytest.approx(expected, abs=0.01)


def test_recommendation_distribution():
    """测试 recommendation 规则逻辑正确（直接验证各分支）"""
    from agents.data_collector import _calc_recommendation

    # promote: composite >= 88, level != P9
    rec, _, _ = _calc_recommendation(90.0, 'P6', 'stable')
    assert rec == 'promote'

    # salary_raise: 80 <= composite < 88
    rec, _, _ = _calc_recommendation(83.0, 'P6', 'stable')
    assert rec == 'salary_raise'

    # pip: composite < 45
    rec, _, _ = _calc_recommendation(40.0, 'P5', 'stable')
    assert rec == 'pip'

    # one_on_one: 45 <= composite < 55 且 trend == 'down'
    rec, _, _ = _calc_recommendation(50.0, 'P5', 'down')
    assert rec == 'one_on_one'

    # normal: 其余情况
    rec, _, _ = _calc_recommendation(65.0, 'P6', 'stable')
    assert rec == 'normal'

    # P9 不能 promote，即使分数 >= 88
    rec, _, _ = _calc_recommendation(92.0, 'P9', 'stable')
    assert rec == 'salary_raise'


@pytest.mark.asyncio
async def test_seed_database(db_session: AsyncSession):
    """测试 seed_database 写入数据库"""
    await seed_database(db_session)

    result = await db_session.execute(select(func.count()).select_from(EmployeeORM))
    count = result.scalar_one()
    assert count == 120
