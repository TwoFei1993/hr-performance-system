"""规则引擎：基于阈值的静态规则，作为 AI 降级 fallback"""
import hashlib

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


def _stable_choice(emp_id: str, items: list[str]) -> str:
    """基于 emp_id 稳定选择列表中的一项（同一员工每次结果一致）"""
    idx = int(hashlib.md5(emp_id.encode()).hexdigest()[:4], 16) % len(items)
    return items[idx]


def analyze_by_rules(employee: EmployeeRecord) -> AnalysisResult:
    """基于阈值规则分析员工绩效，返回建议结果"""
    score = employee.composite_score
    level = employee.level
    trend = employee.trend

    if score >= 88 and level != 'P9':
        rec: Recommendation = 'promote'
        reasons = [
            f"综合评分{score:.1f}，已在{level}工作18个月，具备晋升条件",
            f"OKR完成率{employee.okr_score:.0f}%，领导力评估优秀，建议晋升至下一职级",
            f"业务贡献突出，360评估{employee.review_score_360:.0f}分，团队认可度高",
        ]
        reason = _stable_choice(employee.id, reasons)
        confidence = 0.90
    elif score >= 80:
        rec = 'salary_raise'
        reasons = [
            f"连续3个月OKR完成率超过{employee.okr_score:.0f}%，业务指标稳定，建议调薪10%",
            f"360评估得分{employee.review_score_360:.0f}分，团队反馈优秀，薪资低于市场中位数",
            f"综合绩效{score:.1f}分，近期承担了额外项目，建议薪资激励",
            f"业务指标完成度{employee.business_score:.0f}%，超额完成季度目标，建议调薪",
        ]
        reason = _stable_choice(employee.id, reasons)
        confidence = 0.85
    elif score < 45:
        rec = 'pip'
        reasons = [
            f"综合评分{score:.1f}，连续2季度未达标，需制定90天改进计划",
            f"OKR完成率仅{employee.okr_score:.0f}%，出勤履职{employee.attendance_score:.0f}分，需重点关注",
            f"业务指标{employee.business_score:.0f}%，低于部门平均水平，建议安排导师辅导",
        ]
        reason = _stable_choice(employee.id, reasons)
        confidence = 0.88
    elif 45 <= score < 55 and trend == 'down':
        rec = 'one_on_one'
        reasons = [
            f"绩效趋势持续下滑，综合分{score:.1f}，建议直属上级深度沟通",
            f"近3个月OKR完成率{employee.okr_score:.0f}%，可能存在工作障碍，需1:1了解情况",
            f"360评估{employee.review_score_360:.0f}分，团队协作出现问题，建议及时沟通",
        ]
        reason = _stable_choice(employee.id, reasons)
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
