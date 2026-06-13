"""分析 Agent：调用 MiniMax 分析员工绩效，生成报告"""
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.data_collector import simulate_fluctuation
from models.agent_status import AgentName, AgentRunStatus, AgentStatusInfo
from models.employee import EmployeeRecord, Recommendation
from models.report import Report, ReportType
from services.database import AgentLogORM, EmployeeORM, ReportORM
from services.logger import logger
from services.minimax_client import MiniMaxClient
from services.rule_engine import AnalysisResult

# 全局状态（进程内单例）
_agent_status: AgentRunStatus = 'idle'
_last_run_at: str | None = None
_last_run_result: str | None = None
_run_count: int = 0


def reset_state() -> None:
    """重置分析 Agent 的进程内状态（一键复位用）"""
    global _agent_status, _last_run_at, _last_run_result, _run_count
    _agent_status = 'idle'
    _last_run_at = None
    _last_run_result = None
    _run_count = 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _orm_to_record(emp: EmployeeORM) -> EmployeeRecord:
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


def _build_report(
    scope: str,
    results: list[AnalysisResult],
    report_type: ReportType,
) -> Report:
    counts: dict[Recommendation, int] = {
        'promote': 0, 'salary_raise': 0, 'pip': 0, 'one_on_one': 0, 'normal': 0
    }
    ai_degraded = 0
    for r in results:
        counts[r.recommendation] = counts.get(r.recommendation, 0) + 1
        if r.is_ai_degraded:
            ai_degraded += 1

    total = len(results)
    summary = (
        f"{report_type}分析完成，共分析 {total} 名员工："
        f"建议晋升 {counts['promote']} 人，调薪 {counts['salary_raise']} 人，"
        f"PIP {counts['pip']} 人，1对1 {counts['one_on_one']} 人，"
        f"正常 {counts['normal']} 人"
    )
    content = {
        "scope": scope,
        "analyzed_count": total,
        "promote_count": counts['promote'],
        "salary_raise_count": counts['salary_raise'],
        "pip_count": counts['pip'],
        "one_on_one_count": counts['one_on_one'],
        "normal_count": counts['normal'],
        "ai_degraded_count": ai_degraded,
        "details": [
            {
                "employee_id": r.employee_id,
                "recommendation": r.recommendation,
                "reason": r.reason,
                "confidence": r.confidence,
                "is_ai_degraded": r.is_ai_degraded,
            }
            for r in results
        ],
    }
    return Report(
        id=str(uuid.uuid4()),
        type=report_type,
        generated_at=_now_iso(),
        summary=summary,
        content=content,  # type: ignore[arg-type]
        employee_count=total,
        decision_count=counts['promote'] + counts['salary_raise'] + counts['pip'],
    )


class AnalysisAgent:
    """分析 Agent：串行调用 MiniMax，更新员工推荐，生成报告"""

    def __init__(self) -> None:
        self._client = MiniMaxClient()

    async def run_analysis(self, scope: str, db: AsyncSession) -> Report:
        """执行分析任务。scope: daily/weekly/monthly"""
        global _agent_status, _last_run_at, _last_run_result, _run_count
        _agent_status = 'running'
        started_at = _now_iso()
        log_id = str(uuid.uuid4())

        try:
            employees = await self._fetch_employees(scope, db)
            logger.info(f"分析 Agent 开始 [{scope}]，共 {len(employees)} 名员工")

            results: list[AnalysisResult] = []
            for emp_orm in employees:
                record = _orm_to_record(emp_orm)
                result = await self._client.analyze_employee(record)
                results.append(result)
                # 更新数据库中的推荐字段
                emp_orm.recommendation = result.recommendation
                emp_orm.recommendation_reason = result.reason
                emp_orm.confidence = result.confidence
                emp_orm.is_ai_degraded = result.is_ai_degraded

            await db.commit()

            report_type: ReportType = (
                'monthly' if scope == 'monthly'
                else 'weekly' if scope == 'weekly'
                else 'daily'
            )
            report = _build_report(scope, results, report_type)

            # 写入 reports 表
            db.add(ReportORM(
                id=report.id,
                type=report.type,
                generated_at=report.generated_at,
                summary=report.summary,
                content=json.dumps(report.content, ensure_ascii=False),
                employee_count=report.employee_count,
                decision_count=report.decision_count,
            ))

            # 写入 agent_logs 表
            db.add(AgentLogORM(
                id=log_id,
                agent_name='analysis',
                action=f'run_analysis:{scope}',
                status='success',
                details=json.dumps({
                    "scope": scope,
                    "analyzed": len(results),
                    "report_id": report.id,
                }, ensure_ascii=False),
                created_at=started_at,
            ))
            await db.commit()

            _last_run_at = started_at
            _last_run_result = report.summary
            _run_count += 1
            _agent_status = 'idle'
            logger.info(f"分析 Agent 完成 [{scope}]: {report.summary}")
            return report

        except Exception as e:
            _agent_status = 'error'
            _last_run_result = str(e)
            logger.error(f"分析 Agent 异常: {e}")
            db.add(AgentLogORM(
                id=log_id,
                agent_name='analysis',
                action=f'run_analysis:{scope}',
                status='error',
                details=json.dumps({"error": str(e)}, ensure_ascii=False),
                created_at=started_at,
            ))
            await db.commit()
            raise

    async def _fetch_employees(
        self, scope: str, db: AsyncSession
    ) -> list[EmployeeORM]:
        """根据 scope 决定查询范围"""
        stmt = select(EmployeeORM)
        if scope == 'daily':
            # 增量：只分析 recommendation 为 normal 的员工
            stmt = stmt.where(EmployeeORM.recommendation == 'normal')
        # weekly/monthly 全量
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_status(self) -> AgentStatusInfo:
        """返回当前 Agent 状态"""
        return AgentStatusInfo(
            agent_name='analysis',
            status=_agent_status,
            last_run_at=_last_run_at,
            next_run_at=None,
            run_count=_run_count,
            last_error=_last_run_result if _agent_status == 'error' else None,
        )


# 模块级单例
analysis_agent = AnalysisAgent()
