"""决策审批路由"""
import asyncio
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.decision import Decision, DecisionStatus
from services.database import AsyncSessionLocal, DecisionORM, get_db
from services.logger import logger
from services.sse_manager import SSEEvent, sse_manager

router = APIRouter()


class DecisionListResponse(BaseModel):
    items: list[Decision]
    total: int
    page: int
    size: int


class ApproveRequest(BaseModel):
    resolved_by: Optional[str] = None


def _orm_to_decision(orm: DecisionORM) -> Decision:
    return Decision(
        id=orm.id,
        employee_id=orm.employee_id,
        employee_name=orm.employee_name,
        department=orm.department,  # type: ignore[arg-type]
        type=orm.type,  # type: ignore[arg-type]
        status=orm.status,  # type: ignore[arg-type]
        reason=orm.reason,
        confidence=orm.confidence,
        created_at=orm.created_at,
        resolved_at=orm.resolved_at,
        resolved_by=orm.resolved_by,
        execution_result=orm.execution_result,
    )


async def _get_decision_or_404(
    decision_id: str, db: AsyncSession
) -> DecisionORM:
    result = await db.execute(
        select(DecisionORM).where(DecisionORM.id == decision_id)
    )
    orm = result.scalar_one_or_none()
    if orm is None:
        raise HTTPException(status_code=404, detail=f"决策 {decision_id} 不存在")
    return orm


async def _broadcast_decision_updated(decision: Decision) -> None:
    event = SSEEvent(
        id=str(uuid.uuid4()),
        type='decision_updated',
        data=decision.model_dump(),
        timestamp=decision.resolved_at or decision.created_at,
    )
    await sse_manager.broadcast(event)


async def _run_execution_background(decision_id: str) -> None:
    """后台触发执行 Agent（占位，后续实现）"""
    logger.info(f"执行 Agent 触发 [decision_id={decision_id}]（占位）")


@router.get("/decisions/pending", response_model=DecisionListResponse)
async def get_pending_decisions(
    page: int = 1,
    size: int = 20,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> DecisionListResponse:
    """查询待处理决策列表"""
    stmt = select(DecisionORM).where(DecisionORM.status == 'pending')
    if type is not None:
        stmt = stmt.where(DecisionORM.type == type)

    count_result = await db.execute(stmt)
    all_items = list(count_result.scalars().all())
    total = len(all_items)

    offset = (page - 1) * size
    paginated = all_items[offset: offset + size]
    return DecisionListResponse(
        items=[_orm_to_decision(o) for o in paginated],
        total=total,
        page=page,
        size=size,
    )


@router.post("/decisions/{decision_id}/approve", response_model=Decision)
async def approve_decision(
    decision_id: str,
    req: ApproveRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Decision:
    """审批通过决策"""
    from datetime import datetime, timezone
    orm = await _get_decision_or_404(decision_id, db)
    if orm.status != 'pending':
        raise HTTPException(status_code=400, detail=f"决策状态为 {orm.status}，无法审批")

    now = datetime.now(timezone.utc).isoformat()
    orm.status = 'approved'
    orm.resolved_at = now
    orm.resolved_by = req.resolved_by
    await db.commit()

    decision = _orm_to_decision(orm)
    await _broadcast_decision_updated(decision)
    background_tasks.add_task(_run_execution_background, decision_id)
    logger.info(f"决策 {decision_id} 已审批通过 by {req.resolved_by}")
    return decision


@router.post("/decisions/{decision_id}/reject", response_model=Decision)
async def reject_decision(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
) -> Decision:
    """拒绝决策"""
    from datetime import datetime, timezone
    orm = await _get_decision_or_404(decision_id, db)
    if orm.status != 'pending':
        raise HTTPException(status_code=400, detail=f"决策状态为 {orm.status}，无法拒绝")

    now = datetime.now(timezone.utc).isoformat()
    orm.status = 'rejected'
    orm.resolved_at = now
    await db.commit()

    decision = _orm_to_decision(orm)
    await _broadcast_decision_updated(decision)
    logger.info(f"决策 {decision_id} 已拒绝")
    return decision


@router.post("/decisions/{decision_id}/defer", response_model=Decision)
async def defer_decision(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
) -> Decision:
    """推迟决策"""
    orm = await _get_decision_or_404(decision_id, db)
    if orm.status != 'pending':
        raise HTTPException(status_code=400, detail=f"决策状态为 {orm.status}，无法推迟")

    orm.status = 'deferred'
    await db.commit()

    decision = _orm_to_decision(orm)
    logger.info(f"决策 {decision_id} 已推迟")
    return decision


@router.get("/decisions/history", response_model=DecisionListResponse)
async def get_decision_history(
    page: int = 1,
    size: int = 20,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> DecisionListResponse:
    """查询已处理的决策历史"""
    stmt = select(DecisionORM).where(DecisionORM.status != 'pending')
    if status is not None:
        stmt = stmt.where(DecisionORM.status == status)

    count_result = await db.execute(stmt)
    all_items = list(count_result.scalars().all())
    total = len(all_items)

    offset = (page - 1) * size
    paginated = all_items[offset: offset + size]
    return DecisionListResponse(
        items=[_orm_to_decision(o) for o in paginated],
        total=total,
        page=page,
        size=size,
    )
