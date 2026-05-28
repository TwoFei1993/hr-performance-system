"""员工绩效数据模型"""
from pydantic import BaseModel, Field
from typing import Literal, Optional

Department = Literal['研发', '销售', '运营', '财务', '市场', 'HR']
Level = Literal['P4', 'P5', 'P6', 'P7', 'P8', 'P9']
Trend = Literal['up', 'down', 'stable']
Recommendation = Literal['promote', 'salary_raise', 'pip', 'one_on_one', 'normal']


class EmployeeRecord(BaseModel):
    id: str
    name: str
    department: Department
    level: Level
    manager: str
    hire_date: str
    okr_score: float = Field(ge=0, le=100)
    review_score_360: float = Field(ge=0, le=100)
    business_score: float = Field(ge=0, le=100)
    attendance_score: float = Field(ge=0, le=100)
    composite_score: float = Field(ge=0, le=100)
    score_history: list[float]  # 近6个月
    trend: Trend
    recommendation: Recommendation
    recommendation_reason: str
    confidence: float = Field(ge=0, le=1)
    is_ai_degraded: bool = False


class EmployeeListResponse(BaseModel):
    items: list[EmployeeRecord]
    total: int
    page: int
    size: int
