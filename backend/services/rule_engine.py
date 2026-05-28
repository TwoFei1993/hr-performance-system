"""规则引擎：基于阈值的静态规则，作为 AI 降级 fallback"""
from models.employee import EmployeeRecord, Recommendation


class AnalysisResult:
    """分析结果（轻量数据类，避免循环导入）"""

    def __init__(
        self,
        employee_id: str,
        recommendation: Recommendation,
        reason: str,
        confidence: float,
        is_ai_degraded: bool = False,
    ) -> None:
        self.employee_id = employee_id
        self.recommendation = recommendation
        self.reason = reason
        self.confidence = confidence
        self.is_ai_degraded = is_ai_degraded


def analyze_by_rules(employee: EmployeeRecord) -> AnalysisResult:
    """基于阈值规则分析员工绩效，返回建议结果"""
    score = employee.composite_score
    level = employee.level
    trend = employee.trend

    if score >= 88 and level != 'P9':
        rec: Recommendation = 'promote'
        reason = f'综合评分 {score:.1f}，表现优异，建议晋升'
        confidence = 0.90
    elif score >= 80:
        rec = 'salary_raise'
        reason = f'综合评分 {score:.1f}，绩效良好，建议调薪'
        confidence = 0.85
    elif score < 45:
        rec = 'pip'
        reason = f'综合评分 {score:.1f}，绩效不达标，需制定改进计划'
        confidence = 0.88
    elif 45 <= score < 55 and trend == 'down':
        rec = 'one_on_one'
        reason = f'综合评分 {score:.1f} 且持续下滑，建议一对一辅导'
        confidence = 0.80
    else:
        rec = 'normal'
        reason = f'综合评分 {score:.1f}，表现正常'
        confidence = 0.75

    return AnalysisResult(
        employee_id=employee.id,
        recommendation=rec,
        reason=reason,
        confidence=confidence,
        is_ai_degraded=True,
    )
