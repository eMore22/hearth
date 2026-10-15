from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_supabase_admin, get_current_user, require_module
from app.agents.document_agent import DocumentAgent
import uuid
import traceback

from fastapi.concurrency import run_in_threadpool
from app.services.subscriptions import require_tier, access_for, BillingUnavailable

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
        print(f"📤 Upload started — user: {user.get('id')}, file: {file.filename}, type: {file.content_type}")

        household_id = get_household_id(user)
        print(f"🏠 Household ID: {household_id}")

        if not household_id:
            raise HTTPException(status_code=400, detail="Create a household first")

        supabase = get_supabase_admin()
        file_bytes = await file.read(20 * 1024 * 1024 + 1)
        if not file_bytes or len(file_bytes) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Document size must be 1 byte to 20 MB")
        print(f"📁 File read — size: {len(file_bytes)} bytes")

        # Real content type from the upload, not assumed — this is what
        # lets DocumentAgent route PDFs to its native document path instead
        # of forcing everything through image extraction.
        mime_type = file.content_type or "image/jpeg"
        if mime_type not in ("image/jpeg", "image/png", "image/webp", "application/pdf"):
            raise HTTPException(status_code=415, detail="Unsupported document format")

        # Everyone can safely store a document without spending AI credits.
        # Structured AI extraction is reserved for a RevenueCat-verified
        # Home/Family subscriber; the phone never grants itself this access.
        access = {"tier": "free"}
        try:
            access = await run_in_threadpool(access_for, user)
        except BillingUnavailable:
            pass
        ai_analysis = access.get("tier") in ("home", "family") and access.get("verified")
        extracted = {
            "document_type": "other",
            "title": (file.filename or "Uploaded Document")[:180],
            "issuer": None,
            "holder_name": member_name,
            "issue_date": None,
            "expiry_date": None,
            "document_number": None,
            "key_fields": {},
            "summary": "Stored securely. Upgrade to Home to extract information automatically.",
        }
        if ai_analysis:
            agent = DocumentAgent(household_id=household_id, user_id=user["id"])
            extracted = await run_in_threadpool(agent.extract_document, file_bytes, mime_type)

        # Upload to Supabase Storage
        file_path = f"{household_id}/{uuid.uuid4()}/{file.filename}"
        file_url = None
        try:
            supabase.storage.from_("documents").upload(file_path, file_bytes)
            file_url = f"storage://documents/{file_path}"
        except Exception as storage_error:
            raise HTTPException(status_code=503, detail="Could not store the document securely") from storage_error

        print("💾 Inserting into DB...")
        doc = supabase.table("documents").insert({
            "household_id": household_id,
            "uploaded_by": user["id"],
            "member_name": member_name,
            "file_url": file_url,
            "file_name": file.filename,
            **extracted
        }).execute()
        print("✅ Document record stored")

        return {
            "document": doc.data[0],
            "extracted": extracted,
            "message": ("Document uploaded and analysed." if ai_analysis else "Document uploaded securely. Automatic analysis is a Home feature.")
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not upload document") from e


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
        records = docs.data or []
        for record in records:
            ref = record.get("file_url") or ""
            # Legacy builds saved a public-style URL, but the bucket is
            # private. Sign a household-scoped storage path for either format.
            legacy_prefix = "/storage/v1/object/public/documents/"
            path = None
            if ref.startswith("storage://documents/"):
                path = ref[len("storage://documents/"):]
            elif legacy_prefix in ref:
                from urllib.parse import urlsplit
                path = urlsplit(ref).path.split(legacy_prefix, 1)[-1]
            if path:
                try:
                    signed = supabase.storage.from_("documents").create_signed_url(path, 3600)
                    record["file_url"] = (signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")) if isinstance(signed, dict) else None
                except Exception:
                    record["file_url"] = None
        return records
    except Exception:
        return []


@router.post("/ask", dependencies=[Depends(require_tier("home"))])
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
        household_id = get_household_id(user)
        if not household_id:
            raise HTTPException(status_code=403, detail="No household access")
        deleted = (supabase.table("documents")
                   .delete().eq("id", document_id)
                   .eq("household_id", household_id).execute())
        if not deleted.data:
            raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not delete document")
    return {"message": "Document deleted"}
