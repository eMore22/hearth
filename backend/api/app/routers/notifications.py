from fastapi import APIRouter, Depends, BackgroundTasks, Request
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(tags=["notifications"])

@router.post("/send")
async def send_notification(request: Request, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    body = await request.json()
    return {"status": "queued", "message": "Notification service stub"}

@router.post("/register-token")
async def register_token(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    token = body.get("token")
    device_type = body.get("device_type")
    return {"status": "registered"}