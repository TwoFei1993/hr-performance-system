"""员工绩效 API 路由"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.employee import EmployeeListResponse, EmployeeRecord
from services.database import EmployeeORM, get_db

router = APIRouter()


def _orm_to_model(emp: EmployeeORM) -> EmployeeRecord:
    return EmployeeRecord(
        id=emp.id,
        name=emp.name,
        department=emp.department,  # type: ignore[arg-type]
        level=emp.level,  # type: ignore[arg-type]
        manager=emp.manager,
        hire_date=emp.hire_date,
        okr_score=emp.okr_score,
        review_score_360=emp.review_score_360,
        business_score=emp.business_score,
        attendance_score=emp.attendance_score,
        composite_score=emp.composite_score,
        score_history=json.loads(emp.score_history),
        trend=emp.trend,  # type: ignore[arg-type]
        recommendation=emp.recommendation,  # type: ignore[arg-type]
        recommendation_reason=emp.recommendation_reason,
        confidence=emp.confidence,
        is_ai_degraded=emp.is_ai_degraded,
    )


@router.get("/employees", response_model=EmployeeListResponse)
async def list_employees(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    department: Optional[str] = Query(default=None),
    recommendation: Optional[str] = Query(default=None),
    sort_by: str = Query(default="composite_score"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
) -> EmployeeListResponse:
    """分页查询员工列表，支持部门/推荐类型筛选和排序"""
    stmt = select(EmployeeORM)

    if department:
        stmt = stmt.where(EmployeeORM.department == department)
    if recommendation:
        stmt = stmt.where(EmployeeORM.recommendation == recommendation)

    # 排序字段白名单
    allowed_sort = {
        "composite_score", "okr_score", "review_score_360",
        "business_score", "attendance_score", "name",
    }
    sort_col = sort_by if sort_by in allowed_sort else "composite_score"
    col = getattr(EmployeeORM, sort_col)
    stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())

    # 总数
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # 分页
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = [_orm_to_model(emp) for emp in result.scalars().all()]

    return EmployeeListResponse(items=items, total=total, page=page, size=size)


@router.get("/employees/{employee_id}", response_model=EmployeeRecord)
async def get_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
) -> EmployeeRecord:
    """查询单个员工详情"""
    result = await db.execute(
        select(EmployeeORM).where(EmployeeORM.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail=f"员工 {employee_id} 不存在")
    return _orm_to_model(emp)


@router.get("/dashboard/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """仪表盘统计数据"""
    result = await db.execute(select(EmployeeORM))
    all_emps = result.scalars().all()

    total = len(all_emps)
    pending_promote = sum(1 for e in all_emps if e.recommendation == 'promote')
    pending_salary_raise = sum(1 for e in all_emps if e.recommendation == 'salary_raise')
    pending_pip = sum(1 for e in all_emps if e.recommendation == 'pip')
    pending_one_on_one = sum(1 for e in all_emps if e.recommendation == 'one_on_one')

    # 各部门均分
    dept_scores: dict[str, list[float]] = {}
    for emp in all_emps:
        dept_scores.setdefault(emp.department, []).append(emp.composite_score)
    department_scores = {
        dept: round(sum(scores) / len(scores), 2)
        for dept, scores in dept_scores.items()
    }

    # 分数分布（按20分段）
    ranges = ["0-20", "20-40", "40-60", "60-80", "80-100"]
    distribution = [{"range": r, "count": 0} for r in ranges]
    for emp in all_emps:
        idx = min(int(emp.composite_score // 20), 4)
        distribution[idx]["count"] += 1

    return {
        "total_employees": total,
        "pending_promote": pending_promote,
        "pending_salary_raise": pending_salary_raise,
        "pending_pip": pending_pip,
        "pending_one_on_one": pending_one_on_one,
        "department_scores": department_scores,
        "score_distribution": distribution,
    }
