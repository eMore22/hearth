from fastapi import APIRouter, Depends
from app.dependencies import require_module

router = APIRouter()

@router.get("/")
async def coming_soon(_=Depends(require_module("notification"))):
    return {"status": "coming_soon"}
