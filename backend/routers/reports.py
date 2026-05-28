"""报告查询路由"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.report import Report, ReportType
from services.database import ReportORM, get_db

router = APIRouter()


class ReportListResponse(BaseModel):
    items: list[Report]
    total: int
    page: int
    size: int


def _orm_to_report(orm: ReportORM) -> Report:
    import json
    return Report(
        id=orm.id,
        type=orm.type,  # type: ignore[arg-type]
        generated_at=orm.generated_at,
        summary=orm.summary,
        content=json.loads(orm.content),
        employee_count=orm.employee_count,
        decision_count=orm.decision_count,
    )


async def _get_latest_report(report_type: ReportType, db: AsyncSession) -> Report:
    """查询指定类型的最新报告"""
    stmt = (
        select(ReportORM)
        .where(ReportORM.type == report_type)
        .order_by(ReportORM.generated_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    orm = result.scalar_one_or_none()
    if orm is None:
        raise HTTPException(status_code=404, detail=f"暂无 {report_type} 报告")
    return _orm_to_report(orm)


@router.get("/reports/daily", response_model=Report)
async def get_daily_report(db: AsyncSession = Depends(get_db)) -> Report:
    """获取最新日报"""
    return await _get_latest_report('daily', db)


@router.get("/reports/weekly", response_model=Report)
async def get_weekly_report(db: AsyncSession = Depends(get_db)) -> Report:
    """获取最新周报"""
    return await _get_latest_report('weekly', db)


@router.get("/reports/monthly", response_model=Report)
async def get_monthly_report(db: AsyncSession = Depends(get_db)) -> Report:
    """获取最新月报"""
    return await _get_latest_report('monthly', db)


@router.get("/reports/list", response_model=ReportListResponse)
async def list_reports(
    page: int = 1,
    size: int = 20,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    """报告列表（分页，支持 type 筛选）"""
    stmt = select(ReportORM).order_by(ReportORM.generated_at.desc())
    if type is not None:
        stmt = stmt.where(ReportORM.type == type)

    result = await db.execute(stmt)
    all_items = list(result.scalars().all())
    total = len(all_items)

    offset = (page - 1) * size
    paginated = all_items[offset: offset + size]
    return ReportListResponse(
        items=[_orm_to_report(o) for o in paginated],
        total=total,
        page=page,
        size=size,
    )
