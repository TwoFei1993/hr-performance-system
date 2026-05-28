"""Agent 状态与触发路由"""
import asyncio
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_status import AgentStatusInfo
from services.database import AsyncSessionLocal, get_db
from services.logger import logger

router = APIRouter()

# 其他 Agent 的占位状态（data_collector/decision/execution 尚未实现）
_PLACEHOLDER_AGENTS: list[AgentStatusInfo] = [
    AgentStatusInfo(
        agent_name='data_collector',
        status='idle',
        last_run_at=None,
        next_run_at=None,
        run_count=0,
        last_error=None,
    ),
    AgentStatusInfo(
        agent_name='decision',
        status='idle',
        last_run_at=None,
        next_run_at=None,
        run_count=0,
        last_error=None,
    ),
    AgentStatusInfo(
        agent_name='execution',
        status='idle',
        last_run_at=None,
        next_run_at=None,
        run_count=0,
        last_error=None,
    ),
]


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
    analysis_status = await analysis_agent.get_status()
    return [analysis_status] + _PLACEHOLDER_AGENTS


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
    else:
        # 其他 Agent 占位，返回 202
        logger.info(f"Agent [{req.agent}] 触发请求已接收（占位）")
        return TriggerResponse(
            message=f"Agent [{req.agent}] 尚未实现，已记录请求",
            agent=req.agent,
            scope=req.scope,
        )
