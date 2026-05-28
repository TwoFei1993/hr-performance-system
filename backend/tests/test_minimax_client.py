"""测试规则引擎和 MiniMax 客户端"""
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.employee import EmployeeRecord
from services.rule_engine import AnalysisResult, analyze_by_rules


def _make_employee(
    composite_score: float,
    level: str = 'P6',
    trend: str = 'stable',
) -> EmployeeRecord:
    return EmployeeRecord(
        id='EMP0001',
        name='测试员工',
        department='研发',
        level=level,  # type: ignore[arg-type]
        manager='张总',
        hire_date='2020-01-01',
        okr_score=composite_score,
        review_score_360=composite_score,
        business_score=composite_score,
        attendance_score=composite_score,
        composite_score=composite_score,
        score_history=[composite_score] * 6,
        trend=trend,  # type: ignore[arg-type]
        recommendation='normal',
        recommendation_reason='测试',
        confidence=0.75,
        is_ai_degraded=False,
    )


# ---- 规则引擎测试 ----

def test_rule_engine_promote():
    """composite >= 88 且 level != P9 → promote"""
    emp = _make_employee(90.0, level='P6')
    result = analyze_by_rules(emp)
    assert result.recommendation == 'promote'
    assert result.is_ai_degraded is True
    assert 0 < result.confidence <= 1


def test_rule_engine_no_promote_p9():
    """composite >= 88 但 level == P9 → salary_raise"""
    emp = _make_employee(90.0, level='P9')
    result = analyze_by_rules(emp)
    assert result.recommendation == 'salary_raise'


def test_rule_engine_salary_raise():
    """composite 80-87 → salary_raise"""
    emp = _make_employee(82.0)
    result = analyze_by_rules(emp)
    assert result.recommendation == 'salary_raise'


def test_rule_engine_pip():
    """composite < 45 → pip"""
    emp = _make_employee(40.0)
    result = analyze_by_rules(emp)
    assert result.recommendation == 'pip'


def test_rule_engine_one_on_one():
    """composite 45-55 且 trend == down → one_on_one"""
    emp = _make_employee(50.0, trend='down')
    result = analyze_by_rules(emp)
    assert result.recommendation == 'one_on_one'


def test_rule_engine_normal():
    """composite 55-79 → normal"""
    emp = _make_employee(65.0)
    result = analyze_by_rules(emp)
    assert result.recommendation == 'normal'


def test_rule_engine_45_55_stable_is_normal():
    """composite 45-55 但 trend == stable → normal（不触发 one_on_one）"""
    emp = _make_employee(50.0, trend='stable')
    result = analyze_by_rules(emp)
    assert result.recommendation == 'normal'


def test_analysis_result_structure():
    """AnalysisResult 字段结构正确"""
    r = AnalysisResult(
        employee_id='EMP0001',
        recommendation='promote',
        reason='测试理由',
        confidence=0.9,
        is_ai_degraded=False,
    )
    assert r.employee_id == 'EMP0001'
    assert r.recommendation == 'promote'
    assert r.reason == '测试理由'
    assert r.confidence == 0.9
    assert r.is_ai_degraded is False


# ---- MiniMax 客户端降级测试 ----

@pytest.mark.asyncio
async def test_minimax_client_degrades_on_timeout():
    """httpx 超时时，客户端降级到规则引擎"""
    import httpx
    from services.minimax_client import MiniMaxClient

    emp = _make_employee(90.0, level='P6')

    client = MiniMaxClient()
    client._api_key = 'fake-key'  # 设置假 key，避免走无 key 分支

    with patch('httpx.AsyncClient') as mock_cls:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_cls.return_value = mock_instance

        result = await client.analyze_employee(emp)

    # 降级后应使用规则引擎，is_ai_degraded == True
    assert result.is_ai_degraded is True
    assert result.recommendation in {'promote', 'salary_raise', 'pip', 'one_on_one', 'normal'}


@pytest.mark.asyncio
async def test_minimax_client_no_api_key_degrades():
    """无 API Key 时直接降级到规则引擎"""
    from services.minimax_client import MiniMaxClient

    emp = _make_employee(40.0)
    client = MiniMaxClient()
    client._api_key = ''  # 清空 key

    result = await client.analyze_employee(emp)
    assert result.is_ai_degraded is True
    assert result.recommendation == 'pip'
