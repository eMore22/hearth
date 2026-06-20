"""
Hearth Unified Intake Router
One camera portal. AI classifies what was scanned.
Routes automatically to the correct module.

POST /api/intake/scan   — upload any document image, get back classification + extracted data
GET  /api/intake/recent — last 10 intake results for this household
"""
import uuid
import traceback
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.document_agent import DocumentAgent
from app.services.analytics import log_event

router = APIRouter(tags=["intake"])

DESTINATION_LABELS = {
    "government_id":         ("Documents", "Stored in your document vault with expiry tracking."),
    "insurance":              ("Documents", "Stored in your document vault."),
    "warranty":               ("Documents", "Stored in your document vault with expiry tracking."),
    "utility_bill":           ("Bills",     "Added to your bills and subscriptions."),
    "subscription":           ("Bills",     "Added to your bills and subscriptions."),
    "medical_record":         ("Health",    "Logged in your family health records."),
    "prescription":           ("Health",    "Added to your medications tracker."),
    "lease":                  ("Documents", "Stored in your document vault."),
    "vehicle_registration":   ("Documents", "Stored in your document vault with expiry tracking."),
    "receipt":                ("Documents", "Stored in your document vault."),
    "other":                  ("Documents", "Stored in your document vault."),
}


@router.post("/scan")
async def unified_scan(
    file: UploadFile = File(...),
    member_name: Optional[str] = None,
    user=Depends(get_current_user),
):
    try:
        print(f"📸 Intake scan — user: {user.get('id')}, file: {file.filename}")

        household_id = _get_household_id(user)
        if not household_id:
            raise HTTPException(status_code=400, detail="Create a household first")

        supabase    = get_supabase_admin()
        image_bytes = await file.read()
        print(f"📁 File read — {len(image_bytes)} bytes")

        agent     = DocumentAgent(household_id=household_id, user_id=user["id"])
        extracted = agent.extract_document(image_bytes)
        print(f"✅ Extracted: doc_type={extracted.get('document_type')}, title={extracted.get('title')}")

        doc_type = extracted.get("document_type", "other")
        category = _classify_intake(doc_type, extracted)
        print(f"🗂️  Classified as: {category}")

        result, actual_destination = await _route_to_destination(
            category=category,
            extracted=extracted,
            household_id=household_id,
            user_id=user["id"],
            member_name=member_name,
            image_bytes=image_bytes,
            file_name=file.filename or "scan.jpg",
            supabase=supabase,
        )

        destination_label, destination_message = DESTINATION_LABELS.get(
            actual_destination, ("Documents", "Stored in your document vault.")
        )

        print(f"✅ Routed to {destination_label}")

        # ── Analytics ──
        # This is the single most important event for the "killer feature"
        # question — the unified scanner is the entry point for documents,
        # bills, AND health, so its category breakdown tells you which of
        # those three people actually reach for first.
        log_event(
            supabase=supabase,
            user_id=user["id"],
            household_id=household_id,
            event_name="document_scanned",
            module="intake",
            metadata={
                "document_type":     doc_type,
                "routed_to":         destination_label,
                "extraction_method": "claude_vision",
            },
        )

        return {
            "success":             True,
            "category":            actual_destination,
            "destination":         destination_label,
            "destination_message": destination_message,
            "title":               extracted.get("title", "Scanned Document"),
            "document_type":       doc_type,
            "expiry_date":         extracted.get("expiry_date"),
            "summary":             extracted.get("summary"),
            "toast":               f"{extracted.get('title', 'Document')} → {destination_label}",
            "record":              result,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Intake scan error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/recent")
async def get_recent_scans(user=Depends(get_current_user), limit: int = 10):
    household_id = _get_household_id(user)
    if not household_id:
        return []
    supabase = get_supabase_admin()
    try:
        result = supabase.table("documents")\
            .select("id, title, document_type, created_at, summary")\
            .eq("household_id", household_id)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        return result.data or []
    except Exception:
        return []


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_household_id(user: dict) -> Optional[str]:
    try:
        supabase = get_supabase_admin()
        result   = supabase.table("household_members")\
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


def _classify_intake(doc_type: str, extracted: dict) -> str:
    TYPE_MAP = {
        "passport":             "government_id",
        "national_id":          "government_id",
        "driver_license":       "government_id",
        "vehicle_registration": "vehicle_registration",
        "insurance":            "insurance",
        "warranty":             "warranty",
        "lease":                "lease",
        "medical":              "medical_record",
        "prescription":         "prescription",
        "other":                "other",
    }
    category = TYPE_MAP.get(doc_type, "other")

    title    = (extracted.get("title") or "").lower()
    summary  = (extracted.get("summary") or "").lower()
    combined = title + " " + summary

    bill_keywords = [
        "bill", "invoice", "utility", "electricity", "water",
        "internet", "subscription", "netflix", "receipt", "payment due",
        "amount due", "account number",
    ]
    if any(kw in combined for kw in bill_keywords):
        category = "utility_bill"

    health_keywords = [
        "prescription", "diagnosis", "medication", "dosage",
        "hospital", "clinic", "patient", "medical report",
    ]
    if any(kw in combined for kw in health_keywords):
        category = "medical_record"

    return category


async def _route_to_destination(
    category: str,
    extracted: dict,
    household_id: str,
    user_id: str,
    member_name: Optional[str],
    image_bytes: bytes,
    file_name: str,
    supabase,
):
    """
    Write extracted data to the correct table.
    Returns (record_dict, actual_category_used).
    actual_category_used may differ from `category` if a fallback occurred
    (e.g. health_events insert fails → falls back to documents).
    """

    file_path = f"{household_id}/{uuid.uuid4()}/{file_name}"
    file_url  = None
    try:
        supabase.storage.from_("documents").upload(file_path, image_bytes)
        file_url = supabase.storage.from_("documents").get_public_url(file_path)
    except Exception as e:
        print(f"⚠️ Storage upload failed (non-fatal): {e}")

    # ── Bills routing ──────────────────────────────────────────────────────
    if category in ("utility_bill", "subscription"):
        try:
            key_fields = extracted.get("key_fields") or {}
            provider = (
                extracted.get("issuer")
                or key_fields.get("provider")
                or key_fields.get("company")
                or extracted.get("title", "Unknown Provider")
            )
            amount_raw = (
                key_fields.get("amount_due")
                or key_fields.get("total")
                or key_fields.get("amount")
                or "0"
            )
            try:
                amount = float(str(amount_raw).replace("$", "").replace(",", "").strip())
            except Exception:
                amount = 0.0

            result = supabase.table("bills").insert({
                "household_id":  household_id,
                "name":          provider,
                "provider":      provider,
                "amount":        amount,
                "category":      "utility" if category == "utility_bill" else "subscription",
                "billing_cycle": "monthly",
                "notes":         extracted.get("summary"),
                "is_active":     True,
            }).execute()
            return (result.data[0] if result.data else {}), "utility_bill"
        except Exception as e:
            print(f"⚠️ Bills insert failed ({e}), falling back to documents")
            category = "other"

    # ── Health routing ─────────────────────────────────────────────────────
    if category in ("medical_record", "prescription"):
        try:
            health_payload = {
                "household_id": household_id,
                "title":        extracted.get("title", "Medical Record"),
                "summary":      extracted.get("summary"),
                "event_date":   extracted.get("issue_date"),
            }
            result = supabase.table("health_events").insert(health_payload).execute()
            return (result.data[0] if result.data else {}), "medical_record"
        except Exception as e:
            print(f"⚠️ health_events insert failed ({e}) — falling back to documents table")
            category = "other"

    # ── Documents routing (default + fallback) ─────────────────────────────
    result = supabase.table("documents").insert({
        "household_id": household_id,
        "uploaded_by":  user_id,
        "member_name":  member_name,
        "file_url":     file_url,
        "file_name":    file_name,
        **extracted,
    }).execute()

    final_category = category if category in ("government_id", "insurance", "warranty",
                                                "lease", "vehicle_registration", "receipt") else "other"
    return (result.data[0] if result.data else {}), final_category