"""健康检查路由"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """返回服务健康状态"""
    return {"status": "ok"}
