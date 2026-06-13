"""一键复位路由：清空所有数据、重新 seed、立即触发分析+决策 Agent 生成待审批数据"""
from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from agents.analysis_agent import analysis_agent
from agents.analysis_agent import reset_state as analysis_reset
from agents.data_collector import seed_database
from agents.decision_agent import decision_agent
from agents.decision_agent import reset_state as decision_reset
from agents.execution_agent import reset_state as execution_reset
from services.database import AgentLogORM, DecisionORM, EmployeeORM, ReportORM, get_db
from services.logger import logger

router = APIRouter()


@router.post("/reset")
async def reset_demo(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """一键复位：清空所有数据，重新 seed，并立即运行分析+决策 Agent 生成待审批数据"""
    logger.info("开始一键复位...")

    # 清空所有相关表
    await db.execute(delete(DecisionORM))
    await db.execute(delete(ReportORM))
    await db.execute(delete(AgentLogORM))
    await db.execute(delete(EmployeeORM))
    await db.commit()

    # 重置 agent 进程内状态
    analysis_reset()
    decision_reset()
    execution_reset()

    # 重新 seed 员工数据
    await seed_database(db)
    logger.info("员工数据 seed 完成，开始运行分析 Agent...")

    # 立即运行分析 Agent（weekly 全量模式）
    try:
        await analysis_agent.run_analysis("weekly", db)
        logger.info("分析 Agent 完成，开始运行决策 Agent...")
    except Exception as e:
        logger.error(f"分析 Agent 异常（复位流程继续）: {e}")

    # 立即运行决策 Agent，生成待审批决策
    try:
        created = await decision_agent.generate_decisions(db)
        logger.info(f"决策 Agent 完成，生成 {len(created)} 条待审批决策")
    except Exception as e:
        logger.error(f"决策 Agent 异常（复位流程继续）: {e}")

    logger.info("一键复位完成")
    return {"message": "系统已复位，数据已重置，待审批决策已生成"}
