"""FastAPI 应用入口"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from agents.data_collector import seed_database
from routers.employees import router as employees_router
from routers.health import router as health_router
from services.database import EmployeeORM, get_db, init_db
from services.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化数据库，如果为空则 seed 数据"""
    await init_db()
    # 检查是否需要 seed
    async for db in get_db():
        result = await db.execute(select(func.count()).select_from(EmployeeORM))
        count = result.scalar_one()
        if count == 0:
            logger.info("数据库为空，开始写入 Mock 数据...")
            await seed_database(db)
            logger.info("Mock 数据写入完成，共120条员工记录")
        else:
            logger.info(f"数据库已有 {count} 条员工记录，跳过 seed")
        break
    yield


app = FastAPI(title="绩效管理 Agent API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(employees_router, prefix="/api")

logger.info("绩效管理 Agent 服务启动")

