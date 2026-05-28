"""月会流程路由"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from services.database import get_db
from services.monthly_meeting import (
    MeetingAgenda,
    MeetingMinutes,
    MeetingAgendaItem,
    monthly_meeting_service,
)

router = APIRouter()


class ConfirmItemRequest(BaseModel):
    decision_id: str
    confirmed: bool


@router.post("/monthly-meeting/start", response_model=MeetingAgenda, status_code=201)
async def start_meeting(db: AsyncSession = Depends(get_db)) -> MeetingAgenda:
    """启动月会，汇总所有 pending 决策，返回结构化议程"""
    agenda = await monthly_meeting_service.start_meeting(db)
    return agenda


@router.get("/monthly-meeting/agenda", response_model=MeetingAgenda)
async def get_agenda() -> MeetingAgenda:
    """获取当前进行中的月会议程"""
    agenda = await monthly_meeting_service.get_current_agenda()
    if agenda is None:
        raise HTTPException(status_code=404, detail="当前没有进行中的月会")
    return agenda


@router.post("/monthly-meeting/confirm", response_model=MeetingAgendaItem)
async def confirm_item(
    req: ConfirmItemRequest,
    db: AsyncSession = Depends(get_db),
) -> MeetingAgendaItem:
    """逐条确认或驳回议程项"""
    try:
        item = await monthly_meeting_service.confirm_item(
            req.decision_id, req.confirmed, db
        )
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/monthly-meeting/finish", response_model=MeetingMinutes)
async def finish_meeting(db: AsyncSession = Depends(get_db)) -> MeetingMinutes:
    """结束月会：批量执行确认项，生成月会纪要"""
    try:
        minutes = await monthly_meeting_service.finish_meeting(db)
        return minutes
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
