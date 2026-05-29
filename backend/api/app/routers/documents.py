from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_supabase, get_current_user, require_module
from app.agents.document_agent import DocumentAgent
from app.config import settings
import uuid

router = APIRouter()


class AskDocumentQuestion(BaseModel):
    question: str


def get_household_id(user: dict, supabase) -> Optional[str]:
    """
    Safely fetch household_id for the current user.
    Returns None if the user has no household yet.
    Never crashes on 0 rows.
    """
    try:
        result = supabase.table("household_members")\
            .select("household_id")\
            .eq("user_id", user["id"])\
            .limit(1)\
            .execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["household_id"]
        return None
    except Exception:
        return None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    member_name: Optional[str] = None,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user, supabase)
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")

    image_bytes = await file.read()

    agent = DocumentAgent(household_id=household_id, user_id=user["id"])
    extracted = agent.extract_document(image_bytes)

    # Upload to Supabase Storage
    file_path = f"{household_id}/{uuid.uuid4()}/{file.filename}"
    try:
        supabase.storage.from_("documents").upload(file_path, image_bytes)
        file_url = supabase.storage.from_("documents").get_public_url(file_path)
    except Exception:
        file_url = None

    doc = supabase.table("documents").insert({
        "household_id": household_id,
        "uploaded_by": user["id"],
        "member_name": member_name,
        "file_url": file_url,
        "file_name": file.filename,
        **extracted
    }).execute()

    return {
        "document": doc.data[0],
        "extracted": extracted,
        "message": f"Document uploaded and analysed: {extracted.get('title', 'Unknown')}"
    }


@router.get("/")
async def list_documents(
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user, supabase)
    if not household_id:
        return []

    try:
        docs = supabase.table("documents")\
            .select("*")\
            .eq("household_id", household_id)\
            .order("expiry_date", desc=False)\
            .execute()
        return docs.data or []
    except Exception:
        return []


@router.post("/ask")
async def ask_question(
    payload: AskDocumentQuestion,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user, supabase)
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")

    try:
        docs = supabase.table("documents")\
            .select("*")\
            .eq("household_id", household_id)\
            .execute()
        docs_data = docs.data or []
    except Exception:
        docs_data = []

    agent = DocumentAgent(household_id=household_id, user_id=user["id"])
    answer = agent.answer_question(payload.question, docs_data)

    return {"question": payload.question, "answer": answer}


@router.get("/expiring")
async def get_expiring_documents(
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user, supabase)
    if not household_id:
        return []

    try:
        docs = supabase.table("documents")\
            .select("*")\
            .eq("household_id", household_id)\
            .not_.is_("expiry_date", "null")\
            .execute()
        docs_data = docs.data or []
    except Exception:
        return []

    agent = DocumentAgent(household_id=household_id, user_id=user["id"])
    alerts = agent.check_expiries(docs_data)
    return alerts


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    try:
        supabase.table("documents")\
            .delete()\
            .eq("id", document_id)\
            .execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Document deleted"}