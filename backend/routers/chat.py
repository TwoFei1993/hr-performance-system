"""AI 秘书路由：意图识别 + MiniMax M2.7 对话"""
import os

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.database import EmployeeORM, get_db

router = APIRouter()

SYSTEM_PROMPT = """你是通威集团绩效管理系统的 AI 秘书，由 MiniMax M2.7 驱动。
你可以回答关于员工绩效、薪酬调整、晋升标准、绩效改进计划等问题。
请用专业、简洁的中文回答，每次回答不超过200字。

系统背景：
- 公司有120名员工，分布在研发、销售、运营、财务、市场、HR六个部门
- 绩效评估维度：OKR完成率(30%)、360评估(25%)、业务指标(30%)、出勤履职(15%)
- 建议类型：升职、调薪、PIP（绩效改进计划）、1:1沟通、正常
"""

MINIMAX_API_URL = "https://api.minimax.chat/v1/chat/completions"

REC_LABELS = {
    "promote": "晋升",
    "salary_raise": "调薪",
    "pip": "绩效改进计划",
    "one_on_one": "一对一沟通",
    "normal": "正常",
}


class ChatRequest(BaseModel):
    message: str
    context: str = "performance_management"


class ChatResponse(BaseModel):
    reply: str
    model: str = "MiniMax-M2.7"
    intent: str = ""
    employee_id: str = ""
    employee_name: str = ""
    suggested_reason: str = ""


class ConfirmPromoteRequest(BaseModel):
    employee_id: str
    confirmed: bool
    reason: str = ""


def _build_promote_reason(emp) -> str:
    """确认晋升后写入数据库的最终理由，只用真实达标的维度"""
    parts = []
    if emp.okr_score >= 80:
        parts.append(f"OKR完成率{emp.okr_score:.0f}%")
    if emp.review_score_360 >= 80:
        parts.append(f"360评估{emp.review_score_360:.0f}分")
    if emp.business_score >= 80:
        parts.append(f"业务指标{emp.business_score:.0f}%")
    if emp.attendance_score >= 90:
        parts.append(f"出勤履职{emp.attendance_score:.0f}分")
    if not parts:
        parts.append(f"综合评分{emp.composite_score:.1f}分")
    parts.append(f"在{emp.level}岗位具备晋升潜力，经总经理审批确认")
    return "，".join(parts) + "。"


async def _ask_minimax_promote_analysis(emp, api_key: str) -> str:
    """把员工真实数据传给 MiniMax，让 AI 先说明未推荐原因，再找支持晋升的角度"""
    profile = (
        f"员工：{emp.name}，部门：{emp.department}，职级：{emp.level}\n"
        f"OKR完成率：{emp.okr_score:.1f}%（权重30%，达标线80%）\n"
        f"360评估：{emp.review_score_360:.1f}分（权重25%，达标线80分）\n"
        f"业务指标：{emp.business_score:.1f}%（权重30%，达标线80%）\n"
        f"出勤履职：{emp.attendance_score:.1f}分（权重15%，达标线90分）\n"
        f"综合评分：{emp.composite_score:.1f}分\n"
        f"系统当前建议：{emp.recommendation}（{emp.recommendation_reason or '无'}）"
    )
    prompt = (
        f"老板希望晋升以下员工，请基于真实数据分析：\n\n{profile}\n\n"
        "请按以下结构回复（150字以内，直接输出，不要有思考过程）：\n"
        "**未推荐晋升的原因**：指出哪些维度低于达标线（如实说明，不要回避）\n"
        "**支持晋升的角度**：从上述真实数据中找出确实存在的亮点\n"
        "**建议晋升理由**：一句话，只能基于真实达标的维度，不能编造\n\n"
        "严格要求：只能使用上述真实数据，不得编造或假设任何数字。"
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                MINIMAX_API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "MiniMax-M2.7",
                    "messages": [
                        {"role": "system", "content": "你是通威集团绩效管理AI秘书。只能基于提供的真实数据分析，不得编造任何数字或结论。直接输出分析结果，不要输出思考过程。"},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 800,
                    "temperature": 0.3,
                },
            )
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]
            # 取 </think> 之后的内容；若无 think 块则直接用原文
            import re
            after_think = re.split(r'</think>', raw, flags=re.IGNORECASE)
            text = after_think[-1].strip() if len(after_think) > 1 else raw.strip()
            # 兜底：如果还是空，返回原始数据摘要
            if not text:
                text = (
                    f"OKR完成率{emp.okr_score:.1f}%、360评估{emp.review_score_360:.1f}分、"
                    f"业务指标{emp.business_score:.1f}%、出勤{emp.attendance_score:.1f}分，"
                    f"综合评分{emp.composite_score:.1f}分。系统建议：{emp.recommendation_reason or emp.recommendation}"
                )
            return text
        except Exception as e:
            return (
                f"（AI分析暂时不可用）员工真实数据：OKR {emp.okr_score:.1f}%、"
                f"360评估 {emp.review_score_360:.1f}分、业务指标 {emp.business_score:.1f}%、"
                f"出勤 {emp.attendance_score:.1f}分，综合评分 {emp.composite_score:.1f}分。"
            )


async def _find_employee_in_message(message: str, db: AsyncSession):
    result = await db.execute(select(EmployeeORM))
    employees = result.scalars().all()
    for emp in employees:
        if emp.name in message:
            return emp
    return None


async def _detect_intent(message: str, db: AsyncSession) -> "ChatResponse | None":
    # 查询意图：为什么XX没有晋升 / XX晋升了吗 / XX绩效怎么样
    is_query = (
        ("为什么" in message and ("没有晋升" in message or "没晋升" in message or "晋升" in message))
        or ("晋升了吗" in message or "晋升了没" in message)
        or ("绩效怎么样" in message or "绩效如何" in message or "表现怎么样" in message)
    )
    if is_query:
        emp = await _find_employee_in_message(message, db)
        if emp:
            reason = emp.recommendation_reason or "暂无详细分析记录"
            rec_label = REC_LABELS.get(emp.recommendation, emp.recommendation)
            reply = (
                f"关于**{emp.name}**的绩效分析：\n\n"
                f"当前建议：**{rec_label}**\n\n"
                f"分析原因：{reason}\n\n"
                f"如您认为该员工表现优秀，可以告诉我「我认为{emp.name}应该晋升」，系统将为您准备晋升建议。"
            )
            return ChatResponse(reply=reply)
        else:
            # 找不到员工时，列出部分员工名供参考
            result = await db.execute(select(EmployeeORM).limit(8))
            sample = [e.name for e in result.scalars().all()]
            return ChatResponse(
                reply=f"未在系统中找到该员工。系统中的员工示例：{', '.join(sample)} 等。\n\n请确认姓名后重新提问。"
            )

    # 领导晋升意图：调用 MiniMax 基于真实数据分析，等待确认
    if "应该晋升" in message and ("我认为" in message or "我觉得" in message or "建议晋升" in message):
        emp = await _find_employee_in_message(message, db)
        if emp:
            api_key = os.getenv("MINIMAX_API_KEY", "")
            if api_key:
                analysis = await _ask_minimax_promote_analysis(emp, api_key)
            else:
                # 无 API key 时，只展示真实数据，不编造理由
                analysis = (
                    f"**未推荐晋升的原因**：OKR完成率{emp.okr_score:.1f}%、360评估{emp.review_score_360:.1f}分、"
                    f"业务指标{emp.business_score:.1f}%、出勤{emp.attendance_score:.1f}分，综合评分{emp.composite_score:.1f}分。\n\n"
                    f"系统建议：{emp.recommendation_reason or '暂无'}"
                )
            reply = f"收到您对**{emp.name}**的晋升建议。\n\n{analysis}\n\n请确认是否提交晋升决策？"
            suggested_reason = _build_promote_reason(emp)
            return ChatResponse(
                reply=reply,
                intent="confirm_promote",
                employee_id=emp.id,
                employee_name=emp.name,
                suggested_reason=suggested_reason,
            )
        else:
            result = await db.execute(select(EmployeeORM).limit(8))
            sample = [e.name for e in result.scalars().all()]
            return ChatResponse(
                reply=f"未在系统中找到该员工。系统中的员工示例：{', '.join(sample)} 等。\n\n请确认姓名后重新提问。"
            )

    return None


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)) -> ChatResponse:
    intent_resp = await _detect_intent(req.message, db)
    if intent_resp:
        return intent_resp

    api_key = os.getenv("MINIMAX_API_KEY", "")
    if not api_key:
        return ChatResponse(reply="AI 秘书暂时不可用（未配置 MINIMAX_API_KEY）", model="fallback")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                MINIMAX_API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "MiniMax-M2.7",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": req.message},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            data = resp.json()
            reply: str = data["choices"][0]["message"]["content"]
            return ChatResponse(reply=reply)
        except Exception as e:
            return ChatResponse(reply=f"AI 秘书暂时不可用：{str(e)[:50]}", model="error")


@router.post("/chat/confirm-promote")
async def confirm_promote(req: ConfirmPromoteRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """领导确认晋升后，更新员工推荐并触发决策 Agent"""
    if not req.confirmed:
        return {"message": "已驳回晋升建议，不做任何变更。"}

    result = await db.execute(select(EmployeeORM).where(EmployeeORM.id == req.employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        return {"message": "未找到该员工。"}

    emp.recommendation = "promote"
    emp.recommendation_reason = req.reason or _build_promote_reason(emp)
    emp.confidence = 0.95
    await db.commit()

    from agents.decision_agent import decision_agent
    try:
        created = await decision_agent.generate_decisions(db)
        count = len(created)
    except Exception:
        count = 0

    return {
        "message": f"已确认晋升建议，{emp.name}的晋升决策已生成（共{count}条），请前往「决策审批」页面确认。"
    }
