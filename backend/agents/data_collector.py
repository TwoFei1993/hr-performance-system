"""数据采集 Agent：生成 Mock 员工数据并写入数据库"""
import asyncio
import json
import random
import sys
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.employee import (
    EmployeeRecord,
    Recommendation,
    Trend,
)
from services.database import AsyncSessionLocal, EmployeeORM, init_db

# 百家姓和常用名
SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
            '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']
GIVEN_NAMES = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军',
               '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞']

# 部门配置：(部门名, 人数, 可用级别列表)
DEPT_CONFIG: list[tuple[str, int, list[str]]] = [
    ('研发', 30, ['P4', 'P5', 'P6', 'P7', 'P8']),
    ('销售', 25, ['P4', 'P5', 'P6', 'P7']),
    ('运营', 20, ['P4', 'P5', 'P6', 'P7']),
    ('财务', 15, ['P5', 'P6', 'P7', 'P8']),
    ('市场', 18, ['P4', 'P5', 'P6', 'P7']),
    ('HR',   12, ['P4', 'P5', 'P6', 'P7']),
]

MANAGER_NAMES = ['张总', '李总', '王总', '陈总', '刘总', '赵总']


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _random_score(mean: float = 70.0, std: float = 15.0) -> float:
    # 用 Box-Muller 近似正态分布（标准库实现）
    return _clamp(random.gauss(mean, std))


def _calc_composite(okr: float, r360: float, biz: float, att: float) -> float:
    return _clamp(okr * 0.3 + r360 * 0.25 + biz * 0.3 + att * 0.15)


def _calc_trend(history: list[float]) -> Trend:
    if len(history) < 6:
        return 'stable'
    recent = sum(history[3:]) / 3
    earlier = sum(history[:3]) / 3
    diff = recent - earlier
    if diff > 5:
        return 'up'
    if diff < -5:
        return 'down'
    return 'stable'


def _calc_recommendation(
    composite: float, level: str, trend: Trend
) -> tuple[Recommendation, str, float]:
    if composite >= 88 and level != 'P9':
        return 'promote', f'综合评分 {composite:.1f}，表现优异，建议晋升', 0.92
    if composite >= 80:
        return 'salary_raise', f'综合评分 {composite:.1f}，绩效良好，建议调薪', 0.85
    if composite < 45:
        return 'pip', f'综合评分 {composite:.1f}，绩效不达标，需制定改进计划', 0.88
    if 45 <= composite < 55 and trend == 'down':
        return 'one_on_one', f'综合评分 {composite:.1f} 且持续下滑，建议一对一辅导', 0.80
    return 'normal', f'综合评分 {composite:.1f}，表现正常', 0.75


def _random_hire_date() -> str:
    start = datetime(2015, 1, 1)
    end = datetime(2024, 12, 31)
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, delta))).strftime('%Y-%m-%d')


def _generate_employee(emp_id: str, dept: str, levels: list[str]) -> EmployeeRecord:
    name = random.choice(SURNAMES) + random.choice(GIVEN_NAMES)
    level = random.choice(levels)
    manager = random.choice(MANAGER_NAMES)
    hire_date = _random_hire_date()

    okr = _random_score()
    r360 = _random_score()
    biz = _random_score()
    att = _random_score(mean=85, std=10)
    composite = _calc_composite(okr, r360, biz, att)

    # 近6个月历史：基于当前分数 ±10 随机波动
    history = [_clamp(composite + random.uniform(-10, 10)) for _ in range(6)]
    trend = _calc_trend(history)
    rec, reason, confidence = _calc_recommendation(composite, level, trend)

    return EmployeeRecord(
        id=emp_id,
        name=name,
        department=dept,  # type: ignore[arg-type]
        level=level,  # type: ignore[arg-type]
        manager=manager,
        hire_date=hire_date,
        okr_score=round(okr, 2),
        review_score_360=round(r360, 2),
        business_score=round(biz, 2),
        attendance_score=round(att, 2),
        composite_score=round(composite, 2),
        score_history=[round(h, 2) for h in history],
        trend=trend,
        recommendation=rec,
        recommendation_reason=reason,
        confidence=confidence,
        is_ai_degraded=False,
    )


def generate_mock_employees() -> list[EmployeeRecord]:
    """生成120名员工的 Mock 数据"""
    employees: list[EmployeeRecord] = []
    counter = 1
    for dept, count, levels in DEPT_CONFIG:
        for _ in range(count):
            emp_id = f"EMP{counter:04d}"
            employees.append(_generate_employee(emp_id, dept, levels))
            counter += 1
    return employees


def _employee_to_orm(emp: EmployeeRecord) -> EmployeeORM:
    return EmployeeORM(
        id=emp.id,
        name=emp.name,
        department=emp.department,
        level=emp.level,
        manager=emp.manager,
        hire_date=emp.hire_date,
        okr_score=emp.okr_score,
        review_score_360=emp.review_score_360,
        business_score=emp.business_score,
        attendance_score=emp.attendance_score,
        composite_score=emp.composite_score,
        score_history=json.dumps(emp.score_history, ensure_ascii=False),
        trend=emp.trend,
        recommendation=emp.recommendation,
        recommendation_reason=emp.recommendation_reason,
        confidence=emp.confidence,
        is_ai_degraded=emp.is_ai_degraded,
    )


async def seed_database(db: AsyncSession) -> None:
    """清空员工表并写入120条 Mock 数据"""
    await db.execute(delete(EmployeeORM))
    employees = generate_mock_employees()
    for emp in employees:
        db.add(_employee_to_orm(emp))
    await db.commit()


async def simulate_fluctuation(db: AsyncSession) -> None:
    """随机选20名员工，各维度分数 ±3 随机波动，重新计算 composite 和 trend"""
    result = await db.execute(select(EmployeeORM))
    all_emps = result.scalars().all()
    if not all_emps:
        return

    sample = random.sample(all_emps, min(20, len(all_emps)))
    for emp in sample:
        emp.okr_score = _clamp(emp.okr_score + random.uniform(-3, 3))
        emp.review_score_360 = _clamp(emp.review_score_360 + random.uniform(-3, 3))
        emp.business_score = _clamp(emp.business_score + random.uniform(-3, 3))
        emp.attendance_score = _clamp(emp.attendance_score + random.uniform(-3, 3))
        emp.composite_score = _calc_composite(
            emp.okr_score, emp.review_score_360,
            emp.business_score, emp.attendance_score,
        )
        history: list[float] = json.loads(emp.score_history)
        history.append(round(emp.composite_score, 2))
        history = history[-6:]
        emp.score_history = json.dumps(history, ensure_ascii=False)
        emp.trend = _calc_trend(history)

    await db.commit()


async def _main_seed() -> None:
    await init_db()
    async with AsyncSessionLocal() as db:
        await seed_database(db)
    print("数据库初始化完成，已写入120条员工数据。")


if __name__ == '__main__':
    if '--seed' in sys.argv:
        asyncio.run(_main_seed())
    else:
        print("用法: python -m agents.data_collector --seed")
