"""Public, no-auth legal pages reflecting Hearth's current product operations.

These pages deliberately do not claim completed account deletion, production
bank connectivity, vendor certifications, or data-processing contracts whose
operational evidence has not been verified.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(include_in_schema=False)
BASE = "https://www.hearthhq.online"
CONTACT = "uguomoreeugene123@gmail.com"
CSS = """
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#e9edf7;background:#0b1629}
*{box-sizing:border-box}body{margin:0;background:#0b1629}
main{max-width:760px;margin:0 auto;padding:48px 22px 90px}
nav{padding:20px 24px;border-bottom:1px solid #263b57;display:flex;justify-content:space-between;gap:12px}
a{color:#91c6ff}nav a{font-weight:600}
h1{font-size:clamp(30px,6vw,45px);line-height:1.12}
h2{font-size:20px;margin-top:32px}
p,li{line-height:1.75;color:#cbd3e0}
small{color:#acb8cb}aside{padding:16px 20px;border:1px solid #405374;border-radius:12px}
footer{margin-top:45px;padding-top:20px;border-top:1px solid #263b57}
"""


def _page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow"><title>{title} | Hearth HQ</title>
<style>{CSS}</style></head><body>
<nav><a href="{BASE}">Hearth HQ</a><a href="mailto:{CONTACT}">Contact</a></nav>
<main><h1>{title}</h1><small>Last updated 22 October 2026</small>
{body}<footer><a href="/privacy-policy">Privacy Policy</a> ·
<a href="/terms-of-service">Terms of Service</a> ·
<a href="/account-deletion">Account deletion</a></footer></main></body></html>""",
        headers={"Cache-Control": "public, max-age=300"})


@router.get("/privacy-policy", response_class=HTMLResponse)
def public_privacy_policy():
    return _page("Privacy Policy", """
<aside><p>Hearth HQ is an AI-powered household management service operated by
Eugene Ehis Uguomore. This notice explains Hearth's current data practices and
should be read alongside feature-specific notices. Contact:
<a href="mailto:uguomoreeugene123@gmail.com">uguomoreeugene123@gmail.com</a>.</p></aside>
<h2>Information we collect</h2>
<p>Account email, profile, household role and member records; bills, groceries,
tasks, maintenance, smart-home state and alerts; optional documents and scans;
optional health events, medicines and reminders; AI messages and generated
responses; application usage events and notification tokens. Records may contain
sensitive financial, health, identity and family information. Usage events can
be associated with an account or household and are not universally anonymous.</p>
<h2>Banking and financial connections</h2>
<p>Current Canadian Plaid and Nigerian Mono banking integrations operate in
Sandbox or test mode only. They may display simulated balances and transactions;
they do not connect to live banking or move money. When live connections become
available, Hearth will request separate, clear authorization and disclose the
provider, scope, retention and revocation arrangements before collecting real
financial information. Shared household bills do not automatically make private
bank balances visible to members.</p>
<h2>Why we process data</h2>
<p>To operate selected household features, authenticate accounts, manage
household permissions, send requested alerts, provide AI-assisted summaries,
troubleshoot issues and protect our service. AI responses may be inaccurate and
are not professional medical, legal or financial advice.</p>
<h2>When data is shared</h2>
<p>Hearth relies on technology vendors including Supabase (identity, database
and files), Render (application hosting), Expo (app and notifications),
RevenueCat and Google Play (where purchases are enabled), and AI providers
such as Anthropic and NVIDIA when configured. Only data needed for the
requested feature should be sent. Third-party processing, data locations,
retention and security terms depend on the applicable service contracts;
Hearth does not promise that every vendor has a particular certification or
that every prompt is retained for zero days. We do not sell customer data
to advertising brokers.</p>
<h2>Household access and security</h2>
<p>Members see household-shared records according to their permissions.
Personal Chief conversations and private uploaded documents have additional
access restrictions; document sharing must be selected. Bank balances are
owner-private in the current implementation. Transport encryption, restricted
database access and protected Home Assistant token storage are used, but no
online service can guarantee absolute security.</p>
<h2>Retention, account deletion and user rights</h2>
<p>Information is retained while needed to provide the service, handle
verified account-deletion requests, meet legitimate legal obligations and
maintain security records. Users can request access, correction or deletion.
A request can be submitted in the app under Privacy &amp; Security or via
<a href="/account-deletion">our deletion page</a>. Ownership and shared-family
rights must be checked before removing account records. Some records may be
retained for lawful reasons, and other household members' records may remain.
Hearth will not claim that data has been removed until its deletion is
verified. Google Play subscriptions must be cancelled separately through
Google Play; deleting a Hearth account does not automatically end billing.
We will explain any applicable retention and processing requirements in our
response to the verified requester.</p>
<h2>Children and dependants</h2>
<p>Account registration is intended for adults aged at least 18 years.
Household features may contain information about dependants entered by an
authorized adult. Do not add another person's sensitive data without an
appropriate basis or permission.</p>
<h2>International processing</h2>
<p>Hearth is operated from Nigeria and may use infrastructure or service
providers in other countries, including the United States. Applicable
cross-border safeguards and individual rights depend on the user's region,
the information involved and relevant agreements.</p>
<h2>Updates and contact</h2>
<p>We may update this notice when features or providers change. Material
changes will be disclosed appropriately. For privacy questions or data requests,
email <a href="mailto:uguomoreeugene123@gmail.com">uguomoreeugene123@gmail.com</a>.</p>
""")


@router.get("/terms-of-service", response_class=HTMLResponse)
def public_terms():
    return _page("Terms of Service", """
<p>Hearth HQ is a household organization application operated by Eugene Ehis
Uguomore. By using it, you agree to these terms. You must be at least 18 to
create an account and must have authority to share information about other
household members.</p>
<h2>What Hearth offers</h2>
<p>Features can include personal and shared household records, bill tracking,
document storage, optional health-related reminders, smart-home device
connections and an AI Chief of Staff. AI-generated information is fallible and
does not replace professional advice. Hearth is not an emergency-response
service. Do not rely on Hearth for automated payments, safety-critical home
commands, diagnoses or emergency decisions.</p>
<h2>Bank connections</h2>
<p>Canada and Nigeria banking connections currently use test or Sandbox data.
No real bank connections or payment initiation are generally available.
Availability of any live banking integration will depend on approved
providers, location and clear, separate authorization.</p>
<h2>Plans and billing</h2>
<p>Hearth may offer Free, Home and Family plans. Purchasable subscription
prices and renewal terms are shown by Google Play before checkout.
Subscriptions, cancellation and refunds are administered under Google Play's
applicable policies. Removing an app or deleting a Hearth account does not
automatically cancel an active Google Play subscription. Manage purchases in
your Google Play subscriptions.</p>
<h2>Content and household permissions</h2>
<p>You retain ownership of the records you submit. You permit Hearth to
process the information for the features you use. Do not upload information
you are not entitled to handle or grant access to unrelated household data.
Family access may require an eligible Family subscription. Access and
availability may change where necessary for security or operational reasons.</p>
<h2>Integrations and risks</h2>
<p>External providers can experience downtime or change terms. For Home
Assistant, you control which instance and devices are connected, and you
remain responsible for reviewing and confirming sensitive physical actions.
Hearth does not warrant that third-party connectivity will always be
available or that AI suggestions will be correct.</p>
<h2>Privacy and deletion</h2>
<p>See the <a href="/privacy-policy">Privacy Policy</a> and
<a href="/account-deletion">account-deletion page</a> for information on
personal data, rights, shared household records and deletion requests.
Deletion requests are subject to account verification and lawful retention.</p>
<h2>Support and changes</h2>
<p>For support, email
<a href="mailto:uguomoreeugene123@gmail.com">uguomoreeugene123@gmail.com</a>.
Material changes to these terms will be communicated as appropriate.
Nothing in these terms excludes consumer rights or liabilities that cannot
legally be excluded in the applicable jurisdiction.</p>
""")
