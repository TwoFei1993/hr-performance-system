"""SSE 推送路由"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.sse_manager import sse_manager

router = APIRouter()


@router.get("/stream/notifications")
async def stream_notifications(
    client_id: str,
    last_event_id: str = "",
) -> StreamingResponse:
    """SSE 端点，客户端通过 EventSource 连接"""
    return StreamingResponse(
        sse_manager.event_generator(client_id, last_event_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )
