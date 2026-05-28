"""决策数据模型"""
from pydantic import BaseModel
from typing import Literal, Optional

from models.employee import Department

DecisionType = Literal['promote', 'salary_raise', 'pip', 'one_on_one']
DecisionStatus = Literal['pending', 'approved', 'rejected', 'deferred']


class Decision(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: Department
    type: DecisionType
    status: DecisionStatus
    reason: str
    confidence: float
    created_at: str
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    execution_result: Optional[str] = None
