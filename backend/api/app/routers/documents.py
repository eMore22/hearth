from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_supabase_admin, get_current_user, require_module
from app.agents.document_agent import DocumentAgent
import uuid
import traceback

router = APIRouter()


class AskDocumentQuestion(BaseModel):
    question: str


def get_household_id(user: dict) -> Optional[str]:
    """Admin client — bypasses RLS. Returns None if no household."""
    try:
        supabase = get_supabase_admin()
        result = supabase.table("household_members")\
            .select("household_id")\
            .eq("user_id", user["id"])\
            .limit(1)\
            .execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["household_id"]
        return None
    except Exception as e:
        print(f"⚠️ get_household_id error: {e}")
        return None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    member_name: Optional[str] = None,
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    try:
        print(f"📤 Upload started — user: {user.get('id')}, file: {file.filename}")

        household_id = get_household_id(user)
        print(f"🏠 Household ID: {household_id}")

        if not household_id:
            raise HTTPException(status_code=400, detail="Create a household first")

        supabase = get_supabase_admin()
        image_bytes = await file.read()
        print(f"📁 File read — size: {len(image_bytes)} bytes")

        agent = DocumentAgent(household_id=household_id, user_id=user["id"])
        print("🤖 Running document extraction...")
        extracted = agent.extract_document(image_bytes)
        print(f"✅ Extracted: {extracted}")

        # Upload to Supabase Storage
        file_path = f"{household_id}/{uuid.uuid4()}/{file.filename}"
        file_url = None
        try:
            supabase.storage.from_("documents").upload(file_path, image_bytes)
            file_url = supabase.storage.from_("documents").get_public_url(file_path)
            print(f"☁️ Storage upload OK: {file_url}")
        except Exception as storage_error:
            print(f"⚠️ Storage upload failed (non-fatal): {storage_error}")

        print("💾 Inserting into DB...")
        doc = supabase.table("documents").insert({
            "household_id": household_id,
            "uploaded_by": user["id"],
            "member_name": member_name,
            "file_url": file_url,
            "file_name": file.filename,
            **extracted
        }).execute()
        print(f"✅ DB insert OK: {doc.data}")

        return {
            "document": doc.data[0],
            "extracted": extracted,
            "message": f"Document uploaded and analysed: {extracted.get('title', 'Unknown')}"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UPLOAD ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_documents(
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user)
    if not household_id:
        return []
    supabase = get_supabase_admin()
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
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user)
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")
    supabase = get_supabase_admin()
    try:
        docs = supabase.table("documents").select("*").eq("household_id", household_id).execute()
        docs_data = docs.data or []
    except Exception:
        docs_data = []
    agent = DocumentAgent(household_id=household_id, user_id=user["id"])
    answer = agent.answer_question(payload.question, docs_data)
    return {"question": payload.question, "answer": answer}


@router.get("/expiring")
async def get_expiring_documents(
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user)
    if not household_id:
        return []
    supabase = get_supabase_admin()
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
    return agent.check_expiries(docs_data)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    supabase = get_supabase_admin()
    try:
        supabase.table("documents").delete().eq("id", document_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Document deleted"}