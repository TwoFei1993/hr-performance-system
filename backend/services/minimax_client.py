"""MiniMax API 客户端：调用 MiniMax-M2.7 分析员工绩效"""
import asyncio
import json
import os
from typing import Any

import httpx

from models.employee import EmployeeRecord, Recommendation
from services.rule_engine import AnalysisResult, analyze_by_rules
from services.logger import logger

MINIMAX_BASE_URL = "https://api.minimaxi.chat/v1"
MINIMAX_MODEL = "MiniMax-M2.7"

_SYSTEM_PROMPT = """你是一位专业的HR绩效分析专家。请根据员工的绩效数据，给出客观的评估建议。
请以JSON格式返回，包含以下字段：
- recommendation: 建议类型（promote/salary_raise/pip/one_on_one/normal）
- reason: 建议理由（中文，50字以内）
- confidence: 置信度（0到1之间的小数）

建议类型说明：
- promote: 建议升职（综合表现优秀，达到上一职级标准）
- salary_raise: 建议调薪（表现良好，薪资低于市场水平）
- pip: 建议绩效改进计划（表现持续不达标）
- one_on_one: 建议1对1沟通（有下滑趋势，需要关注）
- normal: 正常（表现符合预期）"""

_VALID_RECOMMENDATIONS: set[str] = {
    'promote', 'salary_raise', 'pip', 'one_on_one', 'normal'
}


def _build_user_prompt(employee: EmployeeRecord) -> str:
    trend_map = {'up': '上升', 'down': '下降', 'stable': '稳定'}
    history_str = ', '.join(str(s) for s in employee.score_history)
    return (
        f"员工信息：\n"
        f"- 姓名：{employee.name}，部门：{employee.department}，职级：{employee.level}\n"
        f"- OKR完成率：{employee.okr_score}/100\n"
        f"- 360评估分：{employee.review_score_360}/100\n"
        f"- 业务指标分：{employee.business_score}/100\n"
        f"- 出勤履职分：{employee.attendance_score}/100\n"
        f"- 综合得分：{employee.composite_score}/100\n"
        f"- 近6个月趋势：{trend_map.get(employee.trend, employee.trend)}"
        f"（up=上升，down=下降，stable=稳定）\n"
        f"- 近6个月得分：{history_str}"
    )


def _parse_ai_response(employee_id: str, raw: str) -> AnalysisResult | None:
    """解析 AI 返回的 JSON，失败返回 None"""
    try:
        # 提取 JSON 块（模型可能包裹在 markdown 代码块中）
        text = raw.strip()
        if "```" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            text = text[start:end]
        data: dict[str, Any] = json.loads(text)
        rec = data.get("recommendation", "")
        if rec not in _VALID_RECOMMENDATIONS:
            return None
        reason = str(data.get("reason", ""))[:100]
        confidence = float(data.get("confidence", 0.7))
        confidence = max(0.0, min(1.0, confidence))
        return AnalysisResult(
            employee_id=employee_id,
            recommendation=rec,  # type: ignore[arg-type]
            reason=reason,
            confidence=confidence,
            is_ai_degraded=False,
        )
    except Exception:
        return None


class MiniMaxClient:
    """MiniMax API 客户端，支持超时重试和规则引擎降级"""

    def __init__(self) -> None:
        self._api_key = os.getenv("MINIMAX_API_KEY", "")
        self._base_url = MINIMAX_BASE_URL
        self._timeout = 30.0
        self._max_retries = 2

    async def analyze_employee(self, employee: EmployeeRecord) -> AnalysisResult:
        """调用 MiniMax 分析员工绩效，失败时降级到规则引擎"""
        if not self._api_key:
            logger.warning("MINIMAX_API_KEY 未配置，使用规则引擎降级")
            return analyze_by_rules(employee)

        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                result = await self._call_api(employee)
                if result is not None:
                    return result
                logger.warning(
                    f"员工 {employee.id} AI 响应解析失败（第{attempt+1}次），降级到规则引擎"
                )
                return analyze_by_rules(employee)
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_error = e
                logger.warning(
                    f"员工 {employee.id} API 调用超时/连接失败（第{attempt+1}次）: {e}"
                )
                if attempt < self._max_retries:
                    await asyncio.sleep(1.0)
            except Exception as e:
                last_error = e
                logger.error(f"员工 {employee.id} API 调用异常: {e}")
                break

        logger.warning(
            f"员工 {employee.id} 重试{self._max_retries}次后仍失败，使用规则引擎降级"
        )
        return analyze_by_rules(employee)

    async def _call_api(self, employee: EmployeeRecord) -> AnalysisResult | None:
        """实际发起 HTTP 请求"""
        payload = {
            "model": MINIMAX_MODEL,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(employee)},
            ],
            "temperature": 0.3,
            "max_tokens": 256,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            raw_content: str = data["choices"][0]["message"]["content"]
            return _parse_ai_response(employee.id, raw_content)
