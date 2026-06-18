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

router = APIRouter(tags=["intake"])

# Maps classifier output to human-readable destination labels
DESTINATION_LABELS = {
    "government_id":         ("Documents", "Stored in your document vault with expiry tracking."),
    "insurance":             ("Documents", "Stored in your document vault."),
    "warranty":              ("Documents", "Stored in your document vault with expiry tracking."),
    "utility_bill":          ("Bills",     "Added to your bills and subscriptions."),
    "subscription":          ("Bills",     "Added to your bills and subscriptions."),
    "medical_record":        ("Health",    "Logged in your family health records."),
    "prescription":          ("Health",    "Added to your medications tracker."),
    "lease":                 ("Documents", "Stored in your document vault."),
    "vehicle_registration":  ("Documents", "Stored in your document vault with expiry tracking."),
    "receipt":               ("Documents", "Stored in your document vault."),
    "other":                 ("Documents", "Stored in your document vault."),
}


@router.post("/scan")
async def unified_scan(
    file: UploadFile = File(...),
    member_name: Optional[str] = None,
    user=Depends(get_current_user),
):
    """
    The single entry point for all physical document scanning.
    Accepts any image, classifies it with Claude Vision, then routes it
    to the correct Supabase table and returns a toast-ready result.
    """
    try:
        print(f"📸 Intake scan — user: {user.get('id')}, file: {file.filename}")

        household_id = _get_household_id(user)
        if not household_id:
            raise HTTPException(status_code=400, detail="Create a household first")

        supabase     = get_supabase_admin()
        image_bytes  = await file.read()
        print(f"📁 File read — {len(image_bytes)} bytes")

        # Step 1: Run Claude Vision extraction (same as documents module)
        agent     = DocumentAgent(household_id=household_id, user_id=user["id"])
        extracted = agent.extract_document(image_bytes)
        print(f"✅ Extracted: doc_type={extracted.get('document_type')}, title={extracted.get('title')}")

        # Step 2: Classify into intake category
        doc_type = extracted.get("document_type", "other")
        category = _classify_intake(doc_type, extracted)
        print(f"🗂️  Classified as: {category}")

        # Step 3: Route to the correct table
        result = await _route_to_destination(
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
            category, ("Documents", "Stored in your document vault.")
        )

        print(f"✅ Routed to {destination_label}")

        return {
            "success":           True,
            "category":          category,
            "destination":       destination_label,
            "destination_message": destination_message,
            "title":             extracted.get("title", "Scanned Document"),
            "document_type":     doc_type,
            "expiry_date":       extracted.get("expiry_date"),
            "summary":           extracted.get("summary"),
            "toast":             f"{extracted.get('title', 'Document')} → {destination_label}",
            "record":            result,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Intake scan error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/recent")
async def get_recent_scans(user=Depends(get_current_user), limit: int = 10):
    """Return the last N documents scanned via the intake portal."""
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
    """
    Map Claude Vision's document_type to an intake category.
    Claude already does the heavy lifting — this just normalises
    the output into the categories our router understands.
    """
    # Direct mappings from Claude's document_type output
    TYPE_MAP = {
        "passport":              "government_id",
        "national_id":           "government_id",
        "driver_license":        "government_id",
        "vehicle_registration":  "vehicle_registration",
        "insurance":             "insurance",
        "warranty":              "warranty",
        "lease":                 "lease",
        "medical":               "medical_record",
        "prescription":          "prescription",
        "other":                 "other",
    }

    category = TYPE_MAP.get(doc_type, "other")

    # Heuristic boost — if title/summary contains billing keywords, treat as bill
    title   = (extracted.get("title") or "").lower()
    summary = (extracted.get("summary") or "").lower()
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
) -> dict:
    """
    Write the extracted data to the correct Supabase table based on category.
    """

    # Upload image to storage
    file_path = f"{household_id}/{uuid.uuid4()}/{file_name}"
    file_url  = None
    try:
        supabase.storage.from_("documents").upload(file_path, image_bytes)
        file_url = supabase.storage.from_("documents").get_public_url(file_path)
    except Exception as e:
        print(f"⚠️ Storage upload failed (non-fatal): {e}")

    # ── Bills routing ──────────────────────────────────────────────────────
    if category in ("utility_bill", "subscription"):
        # Try to extract provider and amount from key_fields
        key_fields = extracted.get("key_fields") or {}
        provider   = (
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
        # Strip currency symbols and commas
        try:
            amount = float(str(amount_raw).replace("$", "").replace(",", "").strip())
        except Exception:
            amount = 0.0

        result = supabase.table("bills").insert({
            "household_id": household_id,
            "name":         provider,
            "provider":     provider,
            "amount":       amount,
            "category":     "utility" if category == "utility_bill" else "subscription",
            "billing_cycle": "monthly",
            "notes":        extracted.get("summary"),
            "is_active":    True,
        }).execute()

        return result.data[0] if result.data else {}

    # ── Health routing ─────────────────────────────────────────────────────
    elif category in ("medical_record", "prescription"):
        result = supabase.table("health_events").insert({
            "household_id": household_id,
            "user_id":      user_id,
            "event_type":   "document_scan",
            "title":        extracted.get("title", "Medical Record"),
            "description":  extracted.get("summary"),
            "notes":        str(extracted.get("key_fields") or {}),
        }).execute()

        return result.data[0] if result.data else {}

    # ── Documents routing (default) ────────────────────────────────────────
    else:
        result = supabase.table("documents").insert({
            "household_id": household_id,
            "uploaded_by":  user_id,
            "member_name":  member_name,
            "file_url":     file_url,
            "file_name":    file_name,
            **extracted,
        }).execute()

        return result.data[0] if result.data else {}