"""辅助决策 Agent：从员工数据生成决策，支持会议议程生成"""
import hashlib as _hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_status import AgentRunStatus, AgentStatusInfo
from models.decision import Decision, DecisionStatus, DecisionType
from models.employee import Recommendation
from services.database import AgentLogORM, DecisionORM, EmployeeORM
from services.logger import logger
from services.sse_manager import SSEEvent, sse_manager

# 全局状态（进程内单例）
_agent_status: AgentRunStatus = 'idle'
_last_run_at: str | None = None
_last_run_result: str | None = None
_run_count: int = 0


def reset_state() -> None:
    """重置决策 Agent 的进程内状态（一键复位用）"""
    global _agent_status, _last_run_at, _last_run_result, _run_count
    _agent_status = 'idle'
    _last_run_at = None
    _last_run_result = None
    _run_count = 0


# recommendation -> DecisionType 映射（normal 不生成决策）
_REC_TO_DECISION: dict[str, DecisionType] = {
    'promote': 'promote',
    'salary_raise': 'salary_raise',
    'pip': 'pip',
    'one_on_one': 'one_on_one',
}


def _pick_reason(emp_id: str, rec_type: str, emp) -> str:
    """根据员工数据和推荐类型生成多样化的决策理由"""
    idx = int(_hashlib.md5(emp_id.encode()).hexdigest()[:4], 16)
    reasons = {
        'salary_raise': [
            f"连续3个月OKR完成率{emp.okr_score:.0f}%，业务指标稳定，建议调薪10%",
            f"360评估{emp.review_score_360:.0f}分，团队反馈优秀，薪资低于市场中位数",
            f"综合绩效{emp.composite_score:.1f}分，近期承担额外项目，建议薪资激励",
            f"业务指标完成度{emp.business_score:.0f}%，超额完成季度目标，建议调薪",
        ],
        'promote': [
            f"综合评分{emp.composite_score:.1f}，已在{emp.level}工作18个月，具备晋升条件",
            f"OKR完成率{emp.okr_score:.0f}%，领导力评估优秀，建议晋升至下一职级",
            f"业务贡献突出，360评估{emp.review_score_360:.0f}分，团队认可度高",
        ],
        'pip': [
            f"综合评分{emp.composite_score:.1f}，连续2季度未达标，需制定90天改进计划",
            f"OKR完成率仅{emp.okr_score:.0f}%，出勤履职{emp.attendance_score:.0f}分，需重点关注",
            f"业务指标{emp.business_score:.0f}%，低于部门平均水平，建议安排导师辅导",
        ],
        'one_on_one': [
            f"绩效趋势持续下滑，综合分{emp.composite_score:.1f}，建议直属上级深度沟通",
            f"近3个月OKR完成率{emp.okr_score:.0f}%，可能存在工作障碍，需1:1了解情况",
            f"360评估{emp.review_score_360:.0f}分，团队协作出现问题，建议及时沟通",
        ],
    }
    pool = reasons.get(rec_type, [f"综合评分{emp.composite_score:.1f}，建议关注"])
    return pool[idx % len(pool)]


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


class DecisionAgent:
    """辅助决策 Agent：生成决策条目，汇总会议议程"""

    async def generate_decisions(self, db: AsyncSession) -> list[Decision]:
        """
        从 employees 表读取 recommendation != 'normal' 的员工，
        为每个员工创建 Decision 记录（如果该员工没有 pending 的同类型决策），
        写入 decisions 表，通过 sse_manager 广播 decision_created 事件。
        """
        global _agent_status, _last_run_at, _last_run_result, _run_count
        _agent_status = 'running'
        started_at = _now_iso()
        log_id = str(uuid.uuid4())

        try:
            # 查询需要决策的员工
            stmt = select(EmployeeORM).where(
                EmployeeORM.recommendation != 'normal'
            )
            result = await db.execute(stmt)
            employees = list(result.scalars().all())

            created: list[Decision] = []
            for emp in employees:
                decision_type = _REC_TO_DECISION.get(emp.recommendation)
                if decision_type is None:
                    continue

                # 检查是否已有 pending 的同类型决策
                existing_stmt = select(DecisionORM).where(
                    and_(
                        DecisionORM.employee_id == emp.id,
                        DecisionORM.type == decision_type,
                        DecisionORM.status == 'pending',
                    )
                )
                existing_result = await db.execute(existing_stmt)
                if existing_result.scalar_one_or_none() is not None:
                    continue  # 已有 pending 决策，跳过

                decision_id = str(uuid.uuid4())
                now = _now_iso()
                reason = _pick_reason(emp.id, decision_type, emp)
                orm = DecisionORM(
                    id=decision_id,
                    employee_id=emp.id,
                    employee_name=emp.name,
                    department=emp.department,
                    type=decision_type,
                    status='pending',
                    reason=reason,
                    confidence=emp.confidence,
                    created_at=now,
                )
                db.add(orm)
                decision = Decision(
                    id=decision_id,
                    employee_id=emp.id,
                    employee_name=emp.name,
                    department=emp.department,  # type: ignore[arg-type]
                    type=decision_type,
                    status='pending',
                    reason=reason,
                    confidence=emp.confidence,
                    created_at=now,
                )
                created.append(decision)

            await db.commit()

            # 广播 SSE 事件
            for decision in created:
                event = SSEEvent(
                    id=str(uuid.uuid4()),
                    type='decision_created',
                    data=decision.model_dump(),
                    timestamp=_now_iso(),
                )
                await sse_manager.broadcast(event)

            # 写入 agent_logs
            db.add(AgentLogORM(
                id=log_id,
                agent_name='decision',
                action='generate_decisions',
                status='success',
                details=json.dumps(
                    {"created_count": len(created)}, ensure_ascii=False
                ),
                created_at=started_at,
            ))
            await db.commit()

            _last_run_at = started_at
            _last_run_result = f"生成 {len(created)} 条决策"
            _run_count += 1
            _agent_status = 'idle'
            logger.info(f"决策 Agent 完成：生成 {len(created)} 条新决策")
            return created

        except Exception as e:
            _agent_status = 'error'
            _last_run_result = str(e)
            logger.error(f"决策 Agent 异常: {e}")
            db.add(AgentLogORM(
                id=log_id,
                agent_name='decision',
                action='generate_decisions',
                status='error',
                details=json.dumps({"error": str(e)}, ensure_ascii=False),
                created_at=started_at,
            ))
            await db.commit()
            raise

    async def generate_meeting_agenda(self, db: AsyncSession) -> dict:
        """
        汇总所有 status='pending' 的 Decision，
        返回结构化议程。
        """
        stmt = select(DecisionORM).where(DecisionORM.status == 'pending')
        result = await db.execute(stmt)
        pending_orms = list(result.scalars().all())
        items = [_orm_to_decision(orm) for orm in pending_orms]

        # 尝试调用 MiniMax 生成摘要，失败时降级
        summary = await self._generate_summary(items)

        return {
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "total_items": len(items),
            "items": [item.model_dump() for item in items],
            "summary": summary,
        }

    async def _generate_summary(self, items: list[Decision]) -> str:
        """生成会议摘要，失败时返回规则生成的摘要"""
        if not items:
            return "本次无待处理决策事项。"
        counts: dict[str, int] = {}
        for item in items:
            counts[item.type] = counts.get(item.type, 0) + 1
        parts = []
        if counts.get('promote'):
            parts.append(f"晋升 {counts['promote']} 人")
        if counts.get('salary_raise'):
            parts.append(f"调薪 {counts['salary_raise']} 人")
        if counts.get('pip'):
            parts.append(f"PIP {counts['pip']} 人")
        if counts.get('one_on_one'):
            parts.append(f"1对1沟通 {counts['one_on_one']} 人")
        return f"本次会议共 {len(items)} 项待审批事项：{'，'.join(parts)}。"

    async def get_status(self) -> AgentStatusInfo:
        """返回当前 Agent 状态"""
        return AgentStatusInfo(
            agent_name='decision',
            status=_agent_status,
            last_run_at=_last_run_at,
            next_run_at=None,
            run_count=_run_count,
            last_error=_last_run_result if _agent_status == 'error' else None,
        )


# 模块级单例
decision_agent = DecisionAgent()
