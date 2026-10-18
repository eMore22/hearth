"""Date-grounded document answers when external AI has no credits.

Uses only authorized, already-loaded metadata. Never fabricates policy
coverage, renewals, identity numbers, or provider-verified facts.
"""
from datetime import date

DOCUMENT_WORDS = {
    "passport": ("passport",),
    "insurance": ("insurance", "policy"),
    "warranty": ("warranty",),
    "lease": ("lease", "tenancy"),
    "id": ("identity", "identification", "licence", "license", "national id"),
    "vehicle": ("vehicle", "registration"),
}


def document_reply(question: str, context: dict) -> str:
    sources = context.get("source_status") or {}
    if sources.get("documents") == "unavailable":
        return "I couldn't check saved documents just now. Try again shortly."
    documents = context.get("documents") or []
    msg = question.casefold()
    if not documents:
        return "No accessible documents are saved in your Hearth vault yet."

    kinds = [name for name, keys in DOCUMENT_WORDS.items()
             if any(key in msg for key in keys)]
    selected = [d for d in documents if not kinds or any(
        keyword in (str(d.get("title") or "") + " " + str(d.get("document_type") or "")).casefold()
        for k in kinds for keyword in DOCUMENT_WORDS[k])]
    if not selected:
        return "I couldn't find a saved document matching that description."

    timeline = []
    undated = []
    today = date.today()
    for doc in selected:
        name = str(doc.get("title") or doc.get("document_type") or "Document")[:90]
        raw = str(doc.get("expiry_date") or "")
        try:
            due = date.fromisoformat(raw[:10]) if len(raw) >= 10 else None
            delta = (due - today).days if due else None
        except ValueError:
            delta = None
            due = None
        if due is None:
            undated.append(name)
            continue
        status = ("expired " + str(abs(delta)) + " day(s) ago" if delta < 0
                  else "expires today" if delta == 0
                  else "expires in " + str(delta) + " day(s)")
        timeline.append((delta, f"{name}: {due.isoformat()} ({status})"))
    timeline.sort(key=lambda item: item[0])

    if any(w in msg for w in ("who issued", "issuer", "which provider", "insurance company")):
        names = [f"{str(d.get('title') or 'Document')[:75]}: " +
                 (str(d.get('issuer'))[:100] if d.get("issuer") else "issuer not recorded")
                 for d in selected[:8]]
        return "Issuers in saved document metadata: " + "; ".join(names) + "."
    if any(w in msg for w in ("whose", "belongs to", "holder", "who owns")):
        names = [f"{str(d.get('title') or 'Document')[:75]}: " +
                 (str(d.get('holder_name'))[:100] if d.get("holder_name") else "holder not recorded")
                 for d in selected[:8]]
        return "Holders in saved document metadata: " + "; ".join(names) + "."

    if any(w in msg for w in ("cover", "coverage", "claim", "terms", "eligible")):
        return ("Hearth has " + str(len(selected)) + " matching saved document(s), but saved "
                "metadata cannot confirm coverage or eligibility. Open the original policy "
                "and verify its exclusions or contact the issuer.")

    if any(w in msg for w in ("soon", "renew", "urgent", "next 30", "overdue", "expired")):
        imminent = [text for delta, text in timeline if delta <= 90]
        if not imminent:
            return (f"No recorded document expiry falls within the next 90 days or is overdue. "
                    f"{len(undated)} matching document(s) have no expiry date saved; "
                    "this is not confirmation they are valid.")
        return ("Upcoming or overdue dates from saved records: " + "; ".join(imminent[:8]) +
                (f". {len(undated)} matching document(s) have no expiry date saved."
                 if undated else "."))

    details = [text for _, text in timeline[:10]]
    details.extend(f"{name}: expiry date not recorded" for name in undated[:10])
    return ("Saved document metadata (not issuer-verified): " +
            "; ".join(details[:12]) + ".")
