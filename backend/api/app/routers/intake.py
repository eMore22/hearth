"""Single secure scan entry point. Classification is advisory, not a payment or
medical-record write. All scans remain private until explicitly shared.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from typing import Optional
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.document_agent import DocumentAgent
from app.services.document_security import (
    safe_filename, valid_upload, clean_extraction, document_visible,
)
from app.services.subscriptions import require_tier
from app.services.analytics import log_event

router = APIRouter(tags=["intake"])

RECOMMENDATIONS = {
    "utility_bill": "Bills", "subscription": "Bills",
    "medical_record": "Health", "prescription": "Health",
}

@router.post("/scan", dependencies=[Depends(require_tier("home"))])
async def unified_scan(
    file: UploadFile = File(...),
    member_name: Optional[str] = Form(None),
    user=Depends(get_current_user),
):
    household_id = str(user.get("household_id") or "")
    if not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    mime = (file.content_type or "").lower()
    if mime not in ("application/pdf", "image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=415, detail="Unsupported scan format")
    data = await file.read(20 * 1024 * 1024 + 1)
    if not data or len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Scan size must be 1 byte to 20 MB")
    if not valid_upload(data, mime):
        raise HTTPException(status_code=415, detail="File content does not match its scan type")

    name = safe_filename(file.filename, mime)
    try:
        agent = DocumentAgent(household_id=household_id, user_id=str(user["id"]))
        raw = await run_in_threadpool(agent.extract_document, data, mime)
    except Exception:
        raw = {}
    extracted = clean_extraction(raw, name)
    category = _classify_intake(extracted.get("document_type") or "other", extracted)
    proposed = RECOMMENDATIONS.get(category)
    path = f"{household_id}/{uuid.uuid4()}/{name}"
    db = get_supabase_admin()
    try:
        db.storage.from_("documents").upload(path, data, {"content-type": mime})
    except Exception:
        raise HTTPException(status_code=503, detail="Secure scan storage unavailable") from None
    try:
        result = db.table("documents").insert({
            **extracted, "household_id": household_id,
            "uploaded_by": user["id"], "member_name": str(member_name).strip()[:140] if member_name else None,
            "file_name": name, "file_url": f"storage://documents/{path}",
            "visibility": "private",
        }).execute()
        if not result.data:
            raise RuntimeError("Could not save scan record")
    except Exception:
        try:
            db.storage.from_("documents").remove([path])
        except Exception:
            pass
        raise HTTPException(status_code=503, detail="Could not save secure scan record") from None

    # A scan never silently creates a bill, medication, diagnosis or payment.
    # Incomplete OCR must not default to zero cost, monthly renewals or a
    # medically verified event. The user reviews the original scan first.
    log_event(supabase=db, user_id=user["id"], household_id=household_id,
              event_name="document_scanned", module="intake",
              metadata={"document_type": extracted["document_type"],
                        "suggested_module": proposed or "Documents"})
    return {
        "success": True, "category": category, "destination": "Documents",
        "suggested_destination": proposed, "requires_review": bool(proposed),
        "destination_message": (
            f"Saved privately in Documents. Review this scan before adding it to {proposed}."
            if proposed else "Saved privately in your document vault."
        ),
        "title": extracted["title"], "document_type": extracted["document_type"],
        "expiry_date": extracted.get("expiry_date"), "summary": extracted.get("summary"),
        "toast": "Scanned document saved privately",
        "record": {"id": result.data[0]["id"], "visibility": "private"},
    }


@router.get("/recent")
async def get_recent_scans(user=Depends(get_current_user), limit: int = 10):
    household_id = str(user.get("household_id") or "")
    if not household_id:
        return []
    if limit < 1 or limit > 50:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 50")
    try:
        result = (get_supabase_admin().table("documents")
                  .select("id,title,document_type,created_at,summary,uploaded_by,visibility")
                  .eq("household_id", household_id).order("created_at", desc=True)
                  .limit(150).execute())
        return [d for d in (result.data or [])
                if document_visible(d, str(user["id"]))][:limit]
    except Exception:
        raise HTTPException(status_code=503, detail="Recent scans unavailable") from None


def _classify_intake(doc_type: str, extracted: dict) -> str:
    types = {
        "passport": "government_id", "national_id": "government_id",
        "driver_license": "government_id", "vehicle_registration": "vehicle_registration",
        "insurance": "insurance", "warranty": "warranty", "lease": "lease",
        "medical": "medical_record", "prescription": "prescription",
    }
    category = types.get(doc_type, "other")
    title = str(extracted.get("title") or "").lower()
    summary = str(extracted.get("summary") or "").lower()
    combined = title + " " + summary
    if any(word in combined for word in (
        "prescription", "diagnosis", "medication", "dosage", "medical report",
    )):
        return "medical_record"
    if any(word in combined for word in (
        "bill", "invoice", "electricity", "internet subscription",
        "payment due", "utility account",
    )):
        return "utility_bill"
    return category
