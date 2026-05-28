"""执行 Agent：根据审批决策执行 HR 操作"""
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_status import AgentRunStatus, AgentStatusInfo
from models.decision import Decision
from services.database import AgentLogORM, DecisionORM, EmployeeORM
from services.logger import logger
from services.sse_manager import SSEEvent, sse_manager

# 全局状态（进程内单例）
_agent_status: AgentRunStatus = 'idle'
_last_run_at: str | None = None
_run_count: int = 0
_last_error: str | None = None

LEVEL_ORDER = ['P4', 'P5', 'P6', 'P7', 'P8', 'P9']


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_level(current: str) -> str:
    """返回下一个职级，已是最高级则保持不变"""
    try:
        idx = LEVEL_ORDER.index(current)
        return LEVEL_ORDER[min(idx + 1, len(LEVEL_ORDER) - 1)]
    except ValueError:
        return current


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


async def _write_log(
    db: AsyncSession,
    agent_name: str,
    action: str,
    status: str,
    details: dict,
) -> None:
    """写入 agent_logs 表"""
    db.add(AgentLogORM(
        id=str(uuid.uuid4()),
        agent_name=agent_name,
        action=action,
        status=status,
        details=json.dumps(details, ensure_ascii=False),
        created_at=_now_iso(),
    ))


class ExecutionAgent:
    """执行 Agent：将审批通过的决策转化为 HR 系统操作"""

    async def execute_decision(self, decision: Decision, db: AsyncSession) -> str:
        """
        根据 decision.type 分发执行：
        - promote: 更新 employees 表的 level
        - salary_raise: 写入 agent_logs（模拟 HR 系统调薪 +10%）
        - pip: 更新 employees 表的 recommendation 为 'pip'，写入日志
        - one_on_one: 写入 agent_logs（模拟创建日历邀请）
        广播 SSE 事件，返回执行结果描述字符串
        """
        global _agent_status, _last_run_at, _run_count, _last_error
        _agent_status = 'running'
        result_msg = ''

        try:
            if decision.type == 'promote':
                result_msg = await self._execute_promote(decision, db)
            elif decision.type == 'salary_raise':
                result_msg = await self._execute_salary_raise(decision, db)
            elif decision.type == 'pip':
                result_msg = await self._execute_pip(decision, db)
            elif decision.type == 'one_on_one':
                result_msg = await self._execute_one_on_one(decision, db)
            else:
                result_msg = f"未知决策类型: {decision.type}"

            await db.commit()

            # 广播 SSE 事件
            event = SSEEvent(
                id=str(uuid.uuid4()),
                type='decision_updated',
                data={**decision.model_dump(), 'execution_result': result_msg},
                timestamp=_now_iso(),
            )
            await sse_manager.broadcast(event)

            _last_run_at = _now_iso()
            _run_count += 1
            _agent_status = 'idle'
            logger.info(f"执行 Agent 完成 [{decision.type}] {decision.employee_name}: {result_msg}")
            return result_msg

        except Exception as e:
            _agent_status = 'error'
            _last_error = str(e)
            logger.error(f"执行 Agent 异常 [{decision.id}]: {e}")
            raise

    async def _execute_promote(self, decision: Decision, db: AsyncSession) -> str:
        """晋升：更新员工职级"""
        result = await db.execute(
            select(EmployeeORM).where(EmployeeORM.id == decision.employee_id)
        )
        emp = result.scalar_one_or_none()
        if emp is None:
            raise ValueError(f"员工 {decision.employee_id} 不存在")

        old_level = emp.level
        new_level = _next_level(old_level)
        emp.level = new_level

        await _write_log(db, 'execution', 'promote', 'success', {
            'decision_id': decision.id,
            'employee_id': decision.employee_id,
            'employee_name': decision.employee_name,
            'old_level': old_level,
            'new_level': new_level,
        })
        return f"员工 {decision.employee_name} 职级从 {old_level} 升至 {new_level}"

    async def _execute_salary_raise(self, decision: Decision, db: AsyncSession) -> str:
        """调薪：写入日志模拟 HR 系统操作"""
        await _write_log(db, 'execution', 'salary_raise', 'success', {
            'decision_id': decision.id,
            'employee_id': decision.employee_id,
            'employee_name': decision.employee_name,
            'raise_percentage': 10,
            'note': '已提交 HR 系统，调薪幅度 +10%',
        })
        return f"员工 {decision.employee_name} 调薪 +10%，已提交 HR 系统"

    async def _execute_pip(self, decision: Decision, db: AsyncSession) -> str:
        """PIP：更新员工 recommendation 并写入日志"""
        result = await db.execute(
            select(EmployeeORM).where(EmployeeORM.id == decision.employee_id)
        )
        emp = result.scalar_one_or_none()
        if emp is None:
            raise ValueError(f"员工 {decision.employee_id} 不存在")

        emp.recommendation = 'pip'
        await _write_log(db, 'execution', 'pip', 'success', {
            'decision_id': decision.id,
            'employee_id': decision.employee_id,
            'employee_name': decision.employee_name,
            'note': 'PIP 计划已启动，员工状态已更新',
        })
        return f"员工 {decision.employee_name} PIP 计划已启动"

    async def _execute_one_on_one(self, decision: Decision, db: AsyncSession) -> str:
        """1对1沟通：写入日志模拟创建日历邀请"""
        await _write_log(db, 'execution', 'one_on_one', 'success', {
            'decision_id': decision.id,
            'employee_id': decision.employee_id,
            'employee_name': decision.employee_name,
            'note': '已创建日历邀请，等待确认',
        })
        return f"员工 {decision.employee_name} 1对1沟通日历邀请已创建"

    async def batch_execute(
        self, decision_ids: list[str], db: AsyncSession
    ) -> list[dict]:
        """批量执行多个决策，返回每个决策的执行结果"""
        results: list[dict] = []
        for did in decision_ids:
            result = await db.execute(
                select(DecisionORM).where(DecisionORM.id == did)
            )
            orm = result.scalar_one_or_none()
            if orm is None:
                results.append({'decision_id': did, 'success': False, 'message': '决策不存在'})
                continue
            decision = _orm_to_decision(orm)
            try:
                msg = await self.execute_decision(decision, db)
                # 更新 execution_result
                orm.execution_result = msg
                await db.commit()
                results.append({'decision_id': did, 'success': True, 'message': msg})
            except Exception as e:
                results.append({'decision_id': did, 'success': False, 'message': str(e)})
        return results

    async def get_status(self) -> AgentStatusInfo:
        return AgentStatusInfo(
            agent_name='execution',
            status=_agent_status,
            last_run_at=_last_run_at,
            next_run_at=None,
            run_count=_run_count,
            last_error=_last_error if _agent_status == 'error' else None,
        )


# 全局单例
execution_agent = ExecutionAgent()
