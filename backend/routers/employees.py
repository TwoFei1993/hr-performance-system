"""员工绩效 API 路由"""
import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.employee import EmployeeListResponse, EmployeeRecord
from services.database import EmployeeORM, get_db


def _random_offset(emp_id: str, dim: str) -> float:
    """基于 emp_id 和维度名生成稳定的随机偏移（-5到+5）"""
    h = int(hashlib.md5(f"{emp_id}{dim}".encode()).hexdigest()[:8], 16)
    return (h % 100 - 50) / 10.0


def _calc_6d_scores(emp: EmployeeORM) -> dict:
    """计算员工6维度能力画像分（含边界保护）"""
    return {
        "job_fit": min(100, max(0, round((emp.business_score * 0.5 + emp.attendance_score * 0.5) + _random_offset(emp.id, 'job_fit'), 1))),
        "innovation": min(100, max(0, round(emp.okr_score * 0.9 + _random_offset(emp.id, 'innovation'), 1))),
        "execution": min(100, max(0, round((emp.business_score * 0.6 + emp.okr_score * 0.4) + _random_offset(emp.id, 'execution'), 1))),
        "teamwork": min(100, max(0, round(emp.review_score_360 * 0.95 + _random_offset(emp.id, 'teamwork'), 1))),
        "growth": min(100, max(0, round((emp.okr_score * 0.5 + emp.review_score_360 * 0.5) + _random_offset(emp.id, 'growth'), 1))),
        "contribution": min(100, max(0, round(emp.business_score * 0.9 + _random_offset(emp.id, 'contribution'), 1))),
    }

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
    department: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """仪表盘统计数据，支持按部门过滤"""
    stmt = select(EmployeeORM)
    if department is not None:
        stmt = stmt.where(EmployeeORM.department == department)

    result = await db.execute(stmt)
    all_emps = result.scalars().all()

    total = len(all_emps)
    pending_promote = sum(1 for e in all_emps if e.recommendation == 'promote')
    pending_salary_raise = sum(1 for e in all_emps if e.recommendation == 'salary_raise')
    pending_pip = sum(1 for e in all_emps if e.recommendation == 'pip')
    pending_one_on_one = sum(1 for e in all_emps if e.recommendation == 'one_on_one')

    # 各部门均分（综合分）
    dept_scores: dict[str, list[float]] = {}
    for emp in all_emps:
        dept_scores.setdefault(emp.department, []).append(emp.composite_score)
    department_scores = {
        dept: round(sum(scores) / len(scores), 2)
        for dept, scores in dept_scores.items()
    }

    # 各部门6维度均分
    dept_6d: dict[str, dict[str, list[float]]] = {}
    dims = ["job_fit", "innovation", "execution", "teamwork", "growth", "contribution"]
    for emp in all_emps:
        scores_6d = _calc_6d_scores(emp)
        dept = emp.department
        if dept not in dept_6d:
            dept_6d[dept] = {d: [] for d in dims}
        for dim in dims:
            dept_6d[dept][dim].append(scores_6d[dim])

    department_6d_scores = {
        dept: {dim: round(sum(vals) / len(vals), 1) for dim, vals in dim_map.items()}
        for dept, dim_map in dept_6d.items()
    }
    # 全公司汇总
    if all_emps:
        all_6d = [_calc_6d_scores(e) for e in all_emps]
        department_6d_scores["全公司"] = {
            dim: round(sum(s[dim] for s in all_6d) / len(all_6d), 1)
            for dim in dims
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
        "department_6d_scores": department_6d_scores,
        "score_distribution": distribution,
    }
