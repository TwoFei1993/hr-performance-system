"""Agent 状态与触发路由"""
import asyncio
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_status import AgentStatusInfo
from services.database import AsyncSessionLocal, get_db
from services.logger import logger

router = APIRouter()

# data_collector 内存状态（进程内持久化）
_data_collector_last_run: datetime | None = None
_data_collector_run_count: int = 0


class TriggerRequest(BaseModel):
    agent: Literal['analysis', 'data_collector', 'decision', 'execution']
    scope: Literal['daily', 'weekly', 'monthly'] = 'daily'


class TriggerResponse(BaseModel):
    message: str
    agent: str
    scope: str


@router.get("/agents/status", response_model=list[AgentStatusInfo])
async def get_agents_status() -> list[AgentStatusInfo]:
    """返回所有 Agent 的当前状态"""
    from agents.analysis_agent import analysis_agent
    from agents.decision_agent import decision_agent
    from agents.execution_agent import execution_agent

    analysis_status = await analysis_agent.get_status()
    decision_status = await decision_agent.get_status()
    execution_status = await execution_agent.get_status()

    # data_collector 使用内存状态
    data_collector_status = AgentStatusInfo(
        agent_name='data_collector',
        status='idle',
        last_run_at=_data_collector_last_run.isoformat() if _data_collector_last_run else None,
        next_run_at=None,
        run_count=_data_collector_run_count,
        last_error=None,
    )
    return [data_collector_status, analysis_status, decision_status, execution_status]


async def _run_analysis_background(scope: str) -> None:
    """后台异步执行分析任务，完成后自动触发决策 Agent"""
    from agents.analysis_agent import analysis_agent
    from agents.decision_agent import decision_agent
    async with AsyncSessionLocal() as db:
        try:
            await analysis_agent.run_analysis(scope, db)
        except Exception as e:
            logger.error(f"后台分析任务失败 [{scope}]: {e}")
            return
    # 分析完成后，自动生成决策（使用新 session）
    async with AsyncSessionLocal() as db:
        try:
            await decision_agent.generate_decisions(db)
        except Exception as e:
            logger.error(f"分析后自动生成决策失败: {e}")


async def _run_data_collector_background() -> None:
    """后台异步执行数据采集（模拟数据波动）"""
    global _data_collector_last_run, _data_collector_run_count
    from agents.data_collector import simulate_fluctuation
    async with AsyncSessionLocal() as db:
        try:
            await simulate_fluctuation(db)
            _data_collector_last_run = datetime.now(timezone.utc)
            _data_collector_run_count += 1
            logger.info("数据采集 Agent 数据波动模拟完成")
        except Exception as e:
            logger.error(f"数据采集 Agent 失败: {e}")


async def _run_decision_background() -> None:
    """后台异步执行决策生成"""
    from agents.decision_agent import decision_agent
    async with AsyncSessionLocal() as db:
        try:
            await decision_agent.generate_decisions(db)
            logger.info("决策 Agent 执行完成")
        except Exception as e:
            logger.error(f"决策 Agent 失败: {e}")



@router.post("/agents/trigger", response_model=TriggerResponse, status_code=202)
async def trigger_agent(
    req: TriggerRequest,
    background_tasks: BackgroundTasks,
) -> TriggerResponse:
    """触发指定 Agent 执行，异步后台运行，立即返回 202"""
    if req.agent == 'analysis':
        background_tasks.add_task(_run_analysis_background, req.scope)
        logger.info(f"分析 Agent 已触发 [scope={req.scope}]")
        return TriggerResponse(
            message="分析任务已提交，正在后台执行",
            agent=req.agent,
            scope=req.scope,
        )
    elif req.agent == 'data_collector':
        background_tasks.add_task(_run_data_collector_background)
        logger.info("数据采集 Agent 已触发")
        return TriggerResponse(
            message="数据采集 Agent 已触发，正在模拟数据波动",
            agent=req.agent,
            scope=req.scope,
        )
    elif req.agent == 'decision':
        background_tasks.add_task(_run_decision_background)
        logger.info("决策 Agent 已触发")
        return TriggerResponse(
            message="辅助决策 Agent 已触发，正在生成决策建议",
            agent=req.agent,
            scope=req.scope,
        )
    elif req.agent == 'execution':
        logger.info("执行 Agent 状态查询")
        return TriggerResponse(
            message="执行 Agent 由决策确认自动触发，当前状态正常",
            agent=req.agent,
            scope=req.scope,
        )
    else:
        raise HTTPException(status_code=400, detail=f"未知 Agent: {req.agent}")
