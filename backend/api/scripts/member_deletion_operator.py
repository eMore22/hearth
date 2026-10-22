"""Restricted manual account-deletion entry point.

Invoke only from approved backend shell after reviewing a fresh deletion plan.
This is intentionally NOT a public FastAPI endpoint and NOT a Celery task.

Two steps: (a) inspect the plan from app.services.deletion_plan, then
(b) create a signed approval with a 10-minute expiry in a restricted operator
environment. Avoid putting the operator secret or token in shell history.
"""
import argparse
import json
from app.services.deletion_executor import execute_member_deletion

def main():
    p = argparse.ArgumentParser(description="Hearth operator-approved member deletion")
    p.add_argument("--request-id", required=True)
    p.add_argument("--review-digest", required=True)
    p.add_argument("--expires-at", required=True, type=int)
    p.add_argument("--approval", required=True)
    args = p.parse_args()
    result = execute_member_deletion(
        request_id=args.request_id, expected_digest=args.review_digest,
        expires_at=args.expires_at, approval=args.approval)
    print(json.dumps(result, sort_keys=True))

if __name__ == "__main__":
    main()
