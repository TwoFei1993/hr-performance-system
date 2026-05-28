"""数据库层：SQLAlchemy async + aiosqlite"""
import json
import os
from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

# 数据库文件路径
_DEFAULT_DB_PATH = Path(__file__).parent.parent / "data" / "performance.db"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{_DEFAULT_DB_PATH}",
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class EmployeeORM(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    level = Column(String, nullable=False)
    manager = Column(String, nullable=False)
    hire_date = Column(String, nullable=False)
    okr_score = Column(Float, nullable=False)
    review_score_360 = Column(Float, nullable=False)
    business_score = Column(Float, nullable=False)
    attendance_score = Column(Float, nullable=False)
    composite_score = Column(Float, nullable=False)
    score_history = Column(Text, nullable=False)  # JSON
    trend = Column(String, nullable=False)
    recommendation = Column(String, nullable=False)
    recommendation_reason = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    is_ai_degraded = Column(Boolean, default=False)


class DecisionORM(Base):
    __tablename__ = "decisions"

    id = Column(String, primary_key=True)
    employee_id = Column(String, nullable=False)
    employee_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    created_at = Column(String, nullable=False)
    resolved_at = Column(String, nullable=True)
    resolved_by = Column(String, nullable=True)
    execution_result = Column(String, nullable=True)


class ReportORM(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    generated_at = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # JSON
    employee_count = Column(Integer, nullable=False)
    decision_count = Column(Integer, nullable=False)


class AgentLogORM(Base):
    __tablename__ = "agent_logs"

    id = Column(String, primary_key=True)
    agent_name = Column(String, nullable=False)
    action = Column(String, nullable=False)
    status = Column(String, nullable=False)
    details = Column(Text, nullable=True)  # JSON
    created_at = Column(String, nullable=False)


async def init_db() -> None:
    """创建所有数据库表"""
    # 确保 data 目录存在
    _DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖注入：提供 AsyncSession"""
    async with AsyncSessionLocal() as session:
        yield session
