from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_supabase_admin, get_current_user, require_module
from app.agents.document_agent import DocumentAgent
import uuid
from app.services.document_security import safe_filename, valid_upload, storage_path, clean_extraction

from fastapi.concurrency import run_in_threadpool
from app.services.subscriptions import require_tier, access_for, BillingUnavailable

router = APIRouter()


class AskDocumentQuestion(BaseModel):
    question: str


def get_household_id(user: dict) -> Optional[str]:
    """Trust the already verified household membership from auth dependency."""
    return str(user.get("household_id") or "") or None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    member_name: Optional[str] = Form(None),
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user)
    if not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    mime_type = (file.content_type or "").lower()
    if mime_type not in ("image/jpeg", "image/png", "image/webp", "application/pdf"):
        raise HTTPException(status_code=415, detail="Unsupported document format")
    data = await file.read(20 * 1024 * 1024 + 1)
    if not data or len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Document size must be 1 byte to 20 MB")
    if not valid_upload(data, mime_type):
        raise HTTPException(status_code=415, detail="File content does not match its document type")
    name = safe_filename(file.filename, mime_type)
    # The model is optional; no credits = still store securely.
    verified = False
    try:
        access = await run_in_threadpool(access_for, user)
        verified = access.get("tier") in ("home", "family") and bool(access.get("verified"))
    except BillingUnavailable:
        pass
    extracted = {
        "document_type": "other", "title": name, "summary":
        "Document stored; automatic extraction requires Hearth Home or Family."
    }
    if verified:
        try:
            agent = DocumentAgent(household_id=household_id, user_id=str(user["id"]))
            extracted = await run_in_threadpool(agent.extract_document, data, mime_type)
        except Exception:
            extracted = {}
    details = clean_extraction(extracted, name)
    if member_name and not details.get("holder_name"):
        details["holder_name"] = str(member_name).strip()[:140]
    path = f"{household_id}/{uuid.uuid4()}/{name}"
    db = get_supabase_admin()
    try:
        db.storage.from_("documents").upload(path, data, {"content-type": mime_type})
    except Exception:
        raise HTTPException(status_code=503, detail="Secure document storage unavailable") from None
    try:
        result = db.table("documents").insert({
            **details, "household_id": household_id, "uploaded_by": user["id"],
            "member_name": str(member_name).strip()[:140] if member_name else None,
            "file_name": name, "file_url": f"storage://documents/{path}",
        }).execute()
        if not result.data:
            raise RuntimeError("Document record not created")
    except Exception:
        # Do not leave a leaked untracked object when a DB insert fails.
        try:
            db.storage.from_("documents").remove([path])
        except Exception:
            pass  # An operator can reconcile an orphan if storage is unavailable.
        raise HTTPException(status_code=503, detail="Document record could not be saved") from None
    record = {k: v for k, v in result.data[0].items()
              if k not in ("file_url", "document_number", "key_fields")}
    return {"document": record, "extracted": {
        k: details.get(k) for k in ("title", "document_type", "expiry_date", "summary")
    }, "message": "Document stored; automatic details extracted." if verified
       else "Document stored securely. Automatic analysis is a Home feature."}


@router.get("/")
async def list_documents(
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user)
    if not household_id:
        return []
    try:
        docs = (get_supabase_admin().table("documents")
                .select("id,title,document_type,issuer,member_name,expiry_date,summary,created_at")
                .eq("household_id", household_id).order("created_at", desc=True)
                .limit(100).execute().data or [])
        # Avoid signing every document at list time. A short-lived URL is
        # issued only after an explicit request for a particular document.
        return docs
    except Exception:
        raise HTTPException(status_code=503, detail="Document list unavailable") from None

@router.get("/{document_id}/access")
async def access_document(document_id: uuid.UUID,
                          user=Depends(get_current_user),
                          _=Depends(require_module("documents"))):
    household_id = get_household_id(user)
    if not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    db = get_supabase_admin()
    try:
        doc = (db.table("documents")
               .select("id,file_url,file_name")
               .eq("id", str(document_id)).eq("household_id", household_id)
               .maybe_single().execute().data)
    except Exception:
        raise HTTPException(status_code=503, detail="Document lookup unavailable") from None
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = storage_path(doc.get("file_url"), household_id)
    if not path:
        raise HTTPException(status_code=404, detail="Secure document file not available")
    try:
        result = db.storage.from_("documents").create_signed_url(path, 300)
        url = result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
        if not isinstance(url, str) or not url.startswith("https://"):
            raise ValueError("Invalid storage signature")
        return {"url": url, "expires_in_seconds": 300,
                "name": doc.get("file_name") or "Document"}
    except Exception:
        raise HTTPException(status_code=503, detail="Secure document link unavailable") from None


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
    document_id: uuid.UUID,
    user=Depends(get_current_user),
    _=Depends(require_module("documents"))
):
    household_id = get_household_id(user)
    if not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    db = get_supabase_admin()
    try:
        record = (db.table("documents").select("id,file_url")
                  .eq("id", str(document_id)).eq("household_id", household_id)
                  .maybe_single().execute().data)
    except Exception:
        raise HTTPException(status_code=503, detail="Document record unavailable") from None
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    ref = record.get("file_url")
    path = storage_path(ref, household_id)
    if ref and not path:
        raise HTTPException(status_code=409, detail="Document storage reference needs repair")
    if path:
        try:
            db.storage.from_("documents").remove([path])
        except Exception:
            # Preserve the DB record until the object can actually be removed.
            raise HTTPException(status_code=503, detail="Storage removal unavailable; retry deletion") from None
    try:
        deleted = (db.table("documents").delete().eq("id", str(document_id))
                   .eq("household_id", household_id).execute())
        if not deleted.data:
            raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Document record removal unavailable") from None
    return {"message": "Document deleted"}
