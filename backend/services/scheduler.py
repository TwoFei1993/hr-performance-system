"""定时任务调度器：APScheduler 管理分析和数据波动任务"""
import asyncio
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from services.database import AsyncSessionLocal
from services.logger import logger

scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")


async def _run_daily_analysis() -> None:
    """每日增量分析任务"""
    from agents.analysis_agent import analysis_agent
    async with AsyncSessionLocal() as db:
        try:
            report = await analysis_agent.run_analysis('daily', db)
            logger.info(f"定时日报完成: {report.summary}")
        except Exception as e:
            logger.error(f"定时日报失败: {e}")


async def _run_weekly_analysis() -> None:
    """每周全量分析任务"""
    from agents.analysis_agent import analysis_agent
    async with AsyncSessionLocal() as db:
        try:
            report = await analysis_agent.run_analysis('weekly', db)
            logger.info(f"定时周报完成: {report.summary}")
        except Exception as e:
            logger.error(f"定时周报失败: {e}")


async def _run_monthly_analysis() -> None:
    """每月全量分析 + 趋势报告"""
    from agents.analysis_agent import analysis_agent
    async with AsyncSessionLocal() as db:
        try:
            report = await analysis_agent.run_analysis('monthly', db)
            logger.info(f"定时月报完成: {report.summary}")
        except Exception as e:
            logger.error(f"定时月报失败: {e}")


async def _run_fluctuation() -> None:
    """每小时数据波动模拟"""
    from agents.data_collector import simulate_fluctuation
    async with AsyncSessionLocal() as db:
        try:
            await simulate_fluctuation(db)
            logger.debug("数据波动模拟完成")
        except Exception as e:
            logger.error(f"数据波动模拟失败: {e}")


def _wrap_async(coro_func: Any):
    """将 async 函数包装为 APScheduler 可调用的同步函数"""
    def wrapper(*args: Any, **kwargs: Any) -> None:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(coro_func(*args, **kwargs))
        else:
            loop.run_until_complete(coro_func(*args, **kwargs))
    return wrapper


def setup_scheduler(app: Any) -> None:
    """注册所有定时任务"""
    # 日报：每日 08:00
    scheduler.add_job(
        _wrap_async(_run_daily_analysis),
        CronTrigger(hour=8, minute=0),
        id='daily_analysis',
        replace_existing=True,
    )
    # 周报：每周一 08:00
    scheduler.add_job(
        _wrap_async(_run_weekly_analysis),
        CronTrigger(day_of_week='mon', hour=8, minute=0),
        id='weekly_analysis',
        replace_existing=True,
    )
    # 月报：每月 1 日 08:00
    scheduler.add_job(
        _wrap_async(_run_monthly_analysis),
        CronTrigger(day=1, hour=8, minute=0),
        id='monthly_analysis',
        replace_existing=True,
    )
    # 数据波动：每小时
    scheduler.add_job(
        _wrap_async(_run_fluctuation),
        CronTrigger(minute=0),
        id='hourly_fluctuation',
        replace_existing=True,
    )
    logger.info("定时任务已注册：日报/周报/月报/数据波动")
