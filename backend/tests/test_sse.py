"""测试 SSE 管理器"""
import asyncio
import sys
import os

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.sse_manager import SSEEvent, SSEManager


def _make_event(event_id: str, event_type: str = "test") -> SSEEvent:
    return SSEEvent(
        id=event_id,
        type=event_type,
        data={"msg": f"event-{event_id}"},
        timestamp="2026-05-28T00:00:00+00:00",
    )


@pytest.mark.asyncio
async def test_connect_registers_client():
    """connect 后客户端存在于 _clients"""
    mgr = SSEManager()
    queue = await mgr.connect("client-1")
    assert "client-1" in mgr._clients
    assert mgr._clients["client-1"] is queue


@pytest.mark.asyncio
async def test_disconnect_removes_client():
    """disconnect 后客户端从 _clients 移除"""
    mgr = SSEManager()
    await mgr.connect("client-1")
    mgr.disconnect("client-1")
    assert "client-1" not in mgr._clients


@pytest.mark.asyncio
async def test_disconnect_nonexistent_client_is_safe():
    """disconnect 不存在的客户端不抛异常"""
    mgr = SSEManager()
    mgr.disconnect("nonexistent")  # 不应抛出


@pytest.mark.asyncio
async def test_broadcast_delivers_to_all_clients():
    """broadcast 将事件推送到所有已连接客户端"""
    mgr = SSEManager()
    q1 = await mgr.connect("c1")
    q2 = await mgr.connect("c2")
    event = _make_event("evt-1", "decision_created")
    await mgr.broadcast(event)
    assert not q1.empty()
    assert not q2.empty()
    assert (await q1.get()).id == "evt-1"
    assert (await q2.get()).id == "evt-1"


@pytest.mark.asyncio
async def test_broadcast_stores_in_history():
    """broadcast 后事件存入历史"""
    mgr = SSEManager()
    event = _make_event("evt-2")
    await mgr.broadcast(event)
    assert len(mgr._event_history) == 1
    assert mgr._event_history[0].id == "evt-2"


@pytest.mark.asyncio
async def test_history_capped_at_max():
    """历史记录不超过 _max_history 条"""
    mgr = SSEManager()
    mgr._max_history = 5
    for i in range(10):
        await mgr.broadcast(_make_event(str(i)))
    assert len(mgr._event_history) == 5
    # 保留最新的5条
    assert mgr._event_history[0].id == "5"
    assert mgr._event_history[-1].id == "9"


@pytest.mark.asyncio
async def test_get_missed_events_returns_events_after_id():
    """get_missed_events 返回 last_event_id 之后的事件"""
    mgr = SSEManager()
    for i in range(5):
        await mgr.broadcast(_make_event(f"e{i}"))
    missed = mgr.get_missed_events("e2")
    assert len(missed) == 2
    assert missed[0].id == "e3"
    assert missed[1].id == "e4"


@pytest.mark.asyncio
async def test_get_missed_events_empty_last_id():
    """last_event_id 为空时返回空列表"""
    mgr = SSEManager()
    await mgr.broadcast(_make_event("e0"))
    assert mgr.get_missed_events("") == []


@pytest.mark.asyncio
async def test_get_missed_events_unknown_id_returns_empty():
    """last_event_id 不在历史中返回空列表"""
    mgr = SSEManager()
    await mgr.broadcast(_make_event("e0"))
    assert mgr.get_missed_events("unknown") == []


@pytest.mark.asyncio
async def test_event_generator_yields_sse_format():
    """event_generator 生成正确的 SSE 格式字符串"""
    mgr = SSEManager()
    event = _make_event("gen-1", "decision_created")

    async def _push():
        await asyncio.sleep(0.05)
        await mgr.broadcast(event)

    asyncio.create_task(_push())
    gen = mgr.event_generator("gen-client")
    chunk = await gen.__anext__()
    assert "id: gen-1" in chunk
    assert "event: decision_created" in chunk
    assert "data:" in chunk
    assert chunk.endswith("\n\n")


@pytest.mark.asyncio
async def test_event_generator_replays_missed_events():
    """event_generator 在连接时补发错过的事件"""
    mgr = SSEManager()
    # 预先广播两条事件（无客户端）
    await mgr.broadcast(_make_event("old-1"))
    await mgr.broadcast(_make_event("old-2"))

    chunks = []
    gen = mgr.event_generator("late-client", last_event_id="old-1")
    # 只取补发的那条
    chunk = await gen.__anext__()
    chunks.append(chunk)
    assert "id: old-2" in chunk
