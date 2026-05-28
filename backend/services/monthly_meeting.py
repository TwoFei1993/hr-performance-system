"""月会业务逻辑服务：管理月度绩效会议流程"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.decision import Decision
from services.database import DecisionORM
from services.logger import logger
from services.sse_manager import SSEEvent, sse_manager


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


class MeetingAgendaItem(BaseModel):
    decision: Decision
    order: int
    confirmed: bool = False


class MeetingAgenda(BaseModel):
    id: str
    date: str
    total_items: int
    items: list[MeetingAgendaItem]
    summary: str
    status: str  # 'in_progress' | 'finished'


class MeetingMinutes(BaseModel):
    id: str
    date: str
    total_decisions: int
    approved_count: int
    rejected_count: int
    deferred_count: int
    decisions: list[Decision]
    execution_results: list[dict]
    generated_at: str


def _generate_agenda_summary(items: list[MeetingAgendaItem]) -> str:
    """规则生成议程摘要"""
    if not items:
        return "本次无待处理决策事项。"
    counts: dict[str, int] = {}
    for item in items:
        counts[item.decision.type] = counts.get(item.decision.type, 0) + 1
    parts = []
    if counts.get('promote'):
        parts.append(f"晋升 {counts['promote']} 人")
    if counts.get('salary_raise'):
        parts.append(f"调薪 {counts['salary_raise']} 人")
    if counts.get('pip'):
        parts.append(f"PIP {counts['pip']} 人")
    if counts.get('one_on_one'):
        parts.append(f"1对1沟通 {counts['one_on_one']} 人")
    return f"本次月会共 {len(items)} 项待审批事项：{'，'.join(parts)}。"


class MonthlyMeetingService:
    """月会服务：管理月度绩效会议的完整流程"""

    _current_agenda: Optional[MeetingAgenda] = None

    async def start_meeting(self, db: AsyncSession) -> MeetingAgenda:
        """汇总所有 pending 决策，生成月会议程，广播 SSE 事件"""
        stmt = select(DecisionORM).where(DecisionORM.status == 'pending')
        result = await db.execute(stmt)
        pending_orms = list(result.scalars().all())

        agenda_items = [
            MeetingAgendaItem(
                decision=_orm_to_decision(orm),
                order=idx + 1,
                confirmed=False,
            )
            for idx, orm in enumerate(pending_orms)
        ]

        summary = _generate_agenda_summary(agenda_items)
        agenda = MeetingAgenda(
            id=str(uuid.uuid4()),
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            total_items=len(agenda_items),
            items=agenda_items,
            summary=summary,
            status='in_progress',
        )
        self._current_agenda = agenda

        event = SSEEvent(
            id=str(uuid.uuid4()),
            type='meeting_started',
            data={'agenda_id': agenda.id, 'total_items': agenda.total_items, 'summary': summary},
            timestamp=_now_iso(),
        )
        await sse_manager.broadcast(event)
        logger.info(f"月会已启动，共 {len(agenda_items)} 项议程")
        return agenda

    async def get_current_agenda(self) -> Optional[MeetingAgenda]:
        return self._current_agenda

    async def confirm_item(
        self, decision_id: str, confirmed: bool, db: AsyncSession
    ) -> MeetingAgendaItem:
        """逐条确认/驳回议程项"""
        if self._current_agenda is None:
            raise ValueError("当前没有进行中的月会")

        for item in self._current_agenda.items:
            if item.decision.id == decision_id:
                item.confirmed = confirmed
                logger.info(
                    f"议程项 {decision_id} 已{'确认' if confirmed else '驳回'}"
                )
                return item

        raise ValueError(f"议程中不存在决策 {decision_id}")

    async def finish_meeting(self, db: AsyncSession) -> MeetingMinutes:
        """批量执行确认项，驳回未确认项，生成月会纪要"""
        if self._current_agenda is None:
            raise ValueError("当前没有进行中的月会")

        from agents.execution_agent import execution_agent

        agenda = self._current_agenda
        confirmed_items = [i for i in agenda.items if i.confirmed]
        rejected_items = [i for i in agenda.items if not i.confirmed]

        execution_results: list[dict] = []
        approved_decisions: list[Decision] = []

        # 执行确认项
        for item in confirmed_items:
            orm_result = await db.execute(
                select(DecisionORM).where(DecisionORM.id == item.decision.id)
            )
            orm = orm_result.scalar_one_or_none()
            if orm is None:
                continue
            now = _now_iso()
            orm.status = 'approved'
            orm.resolved_at = now
            orm.resolved_by = '月会'
            await db.commit()

            updated_decision = _orm_to_decision(orm)
            try:
                exec_msg = await execution_agent.execute_decision(updated_decision, db)
                orm.execution_result = exec_msg
                await db.commit()
                execution_results.append({
                    'decision_id': item.decision.id,
                    'success': True,
                    'message': exec_msg,
                })
                approved_decisions.append(_orm_to_decision(orm))
            except Exception as e:
                execution_results.append({
                    'decision_id': item.decision.id,
                    'success': False,
                    'message': str(e),
                })

        # 驳回未确认项
        rejected_decisions: list[Decision] = []
        for item in rejected_items:
            orm_result = await db.execute(
                select(DecisionORM).where(DecisionORM.id == item.decision.id)
            )
            orm = orm_result.scalar_one_or_none()
            if orm is None:
                continue
            orm.status = 'rejected'
            orm.resolved_at = _now_iso()
            orm.resolved_by = '月会'
            await db.commit()
            rejected_decisions.append(_orm_to_decision(orm))

        all_decisions = approved_decisions + rejected_decisions
        minutes = MeetingMinutes(
            id=str(uuid.uuid4()),
            date=agenda.date,
            total_decisions=len(agenda.items),
            approved_count=len(confirmed_items),
            rejected_count=len(rejected_items),
            deferred_count=0,
            decisions=all_decisions,
            execution_results=execution_results,
            generated_at=_now_iso(),
        )

        # 清空当前议程
        self._current_agenda = None

        event = SSEEvent(
            id=str(uuid.uuid4()),
            type='meeting_finished',
            data={
                'minutes_id': minutes.id,
                'approved_count': minutes.approved_count,
                'rejected_count': minutes.rejected_count,
            },
            timestamp=_now_iso(),
        )
        await sse_manager.broadcast(event)
        logger.info(
            f"月会结束：审批 {minutes.approved_count} 项，驳回 {minutes.rejected_count} 项"
        )
        return minutes


# 全局单例
monthly_meeting_service = MonthlyMeetingService()
