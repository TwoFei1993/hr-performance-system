"""报告数据模型"""
from pydantic import BaseModel
from typing import Literal

ReportType = Literal['daily', 'weekly', 'monthly']


class Report(BaseModel):
    id: str
    type: ReportType
    generated_at: str
    summary: str
    content: dict  # 结构化内容
    employee_count: int
    decision_count: int
