"""SSE 推送管理器：管理客户端连接与事件广播"""
import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator

from pydantic import BaseModel


class SSEEvent(BaseModel):
    id: str
    type: str  # 'decision_created' | 'decision_updated' | 'agent_status' | 'report_ready'
    data: dict
    timestamp: str


class SSEManager:
    """管理 SSE 客户端连接，支持广播与断线重连"""

    def __init__(self) -> None:
        self._clients: dict[str, asyncio.Queue] = {}  # client_id -> Queue
        self._event_history: list[SSEEvent] = []  # 最近50条
        self._max_history: int = 50

    async def connect(self, client_id: str) -> asyncio.Queue:
        """注册客户端，返回其专属队列"""
        queue: asyncio.Queue = asyncio.Queue()
        self._clients[client_id] = queue
        return queue

    def disconnect(self, client_id: str) -> None:
        """移除客户端"""
        self._clients.pop(client_id, None)

    async def broadcast(self, event: SSEEvent) -> None:
        """广播事件到所有客户端，并存入历史"""
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]
        for queue in self._clients.values():
            await queue.put(event)

    def get_missed_events(self, last_event_id: str) -> list[SSEEvent]:
        """返回 last_event_id 之后的所有历史事件（用于断线重连）"""
        if not last_event_id:
            return []
        for i, event in enumerate(self._event_history):
            if event.id == last_event_id:
                return self._event_history[i + 1:]
        return []

    async def event_generator(
        self, client_id: str, last_event_id: str = ""
    ) -> AsyncGenerator[str, None]:
        """SSE 事件流生成器"""
        queue = await self.connect(client_id)
        # 补发错过的事件
        for event in self.get_missed_events(last_event_id):
            yield f"id: {event.id}\nevent: {event.type}\ndata: {event.model_dump_json()}\n\n"
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"id: {event.id}\nevent: {event.type}\ndata: {event.model_dump_json()}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # 心跳，保持连接
        except asyncio.CancelledError:
            pass
        finally:
            self.disconnect(client_id)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# 全局单例
sse_manager = SSEManager()
