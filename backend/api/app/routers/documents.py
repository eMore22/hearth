from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from app.dependencies import get_supabase, get_current_user, require_module
from app.agents.document_agent import DocumentAgent
from app.config import settings
import uuid

router = APIRouter()


class AskDocumentQuestion(BaseModel):
    question: str


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    member_name: Optional[str] = None,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    """Upload a document photo — OCR + AI extraction runs automatically."""
    # Get household
    member_row = supabase.table("household_members")\
        .select("household_id")\
        .eq("user_id", user.id)\
        .single()\
        .execute()

    if not member_row.data:
        raise HTTPException(status_code=400, detail="Create a household first")

    household_id = member_row.data["household_id"]

    # Read file bytes
    image_bytes = await file.read()

    # Run document agent
    agent = DocumentAgent(household_id=household_id, user_id=user.id)
    extracted = agent.extract_document(image_bytes)

    # Upload file to Supabase Storage
    file_path = f"{household_id}/{uuid.uuid4()}/{file.filename}"
    supabase.storage.from_("documents").upload(file_path, image_bytes)
    file_url = supabase.storage.from_("documents").get_public_url(file_path)

    # Save to DB
    doc = supabase.table("documents").insert({
        "household_id": household_id,
        "uploaded_by": user.id,
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
    """List all documents in the household vault."""
    member_row = supabase.table("household_members")\
        .select("household_id")\
        .eq("user_id", user.id)\
        .single()\
        .execute()

    if not member_row.data:
        return []

    docs = supabase.table("documents")\
        .select("*")\
        .eq("household_id", member_row.data["household_id"])\
        .order("expiry_date", desc=False)\
        .execute()

    return docs.data


@router.post("/ask")
async def ask_question(
    payload: AskDocumentQuestion,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    """Ask a natural language question about your documents."""
    member_row = supabase.table("household_members")\
        .select("household_id")\
        .eq("user_id", user.id)\
        .single()\
        .execute()

    if not member_row.data:
        raise HTTPException(status_code=400, detail="No household found")

    household_id = member_row.data["household_id"]

    # Fetch all household documents for context
    docs = supabase.table("documents")\
        .select("*")\
        .eq("household_id", household_id)\
        .execute()

    agent = DocumentAgent(household_id=household_id, user_id=user.id)
    answer = agent.answer_question(payload.question, docs.data)

    return {"question": payload.question, "answer": answer}


@router.get("/expiring")
async def get_expiring_documents(
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    """Get documents expiring within 90 days."""
    member_row = supabase.table("household_members")\
        .select("household_id")\
        .eq("user_id", user.id)\
        .single()\
        .execute()

    if not member_row.data:
        return []

    docs = supabase.table("documents")\
        .select("*")\
        .eq("household_id", member_row.data["household_id"])\
        .not_.is_("expiry_date", "null")\
        .execute()

    agent = DocumentAgent(
        household_id=member_row.data["household_id"],
        user_id=user.id
    )
    alerts = agent.check_expiries(docs.data)
    return alerts


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
    _=Depends(require_module("documents"))
):
    supabase.table("documents")\
        .delete()\
        .eq("id", document_id)\
        .execute()
    return {"message": "Document deleted"}
