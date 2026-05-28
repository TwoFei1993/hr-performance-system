"""Agent 状态数据模型"""
from pydantic import BaseModel
from typing import Literal, Optional

AgentName = Literal['data_collector', 'analysis', 'decision', 'execution']
AgentRunStatus = Literal['idle', 'running', 'error']


class AgentStatusInfo(BaseModel):
    agent_name: AgentName
    status: AgentRunStatus
    last_run_at: Optional[str] = None
    next_run_at: Optional[str] = None
    run_count: int = 0
    last_error: Optional[str] = None
