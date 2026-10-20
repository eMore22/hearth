# Hearth HQ compliance implementation register — 20 October 2026

**Status: ENGINEERING / LEGAL REVIEW REQUIRED. NOT A COMPLIANCE CERTIFICATE.**
Markets: Canada first, Nigeria next, US expansion. Entity incorporation, controller/processor allocation, contracts and exact coverage require legal confirmation. Hearth processes sensitive household finances, personal health events, documents and connected-home events; financial banking live-access remains disabled pending providers.

## Required release evidence and owners
| Gate | Evidence to obtain | Status |
| --- | --- | --- |
| Google Play account deletion | In-app deletion path; functional external account-deletion URL; verified processing of Auth, Storage, DB and authorized provider revocation; distinguish request from completed deletion; documented lawful retention exceptions | BLOCKED: request + preflight only |
| Google Play Data safety | Inventory each collected/shared data class incl. every third-party SDK, purpose, encryption in transit, retention and delete options; ensure published notice matches declarations | NOT VERIFIED |
| Google Play Health apps declaration | Declare health-related features accurately in Play Console, including medication/health records; publish visible in-app and public health-data disclosures | NOT VERIFIED |
| Google Play payments and subscriptions | Verified tester purchase, renewal/cancellation, restore, refund/entitlement handling; Google Play Billing compliance; RevenueCat server enforcement after test | NOT VERIFIED |
| Data privacy notice | Verify legal controller name/address, contact, processing purposes and legal bases as applicable, data types, sharing, AI providers, cross-border transfers, retention, deletion/access rights, child age rules | DRAFT ONLY |
| Vendor due diligence | Execute proper terms/DPA as applicable for Supabase, Render, RevenueCat, AI vendors and banking connectors; map subprocessors, data residency, key handling and access | NOT VERIFIED |
| Financial connectivity | Provider KYB/contract, explicit read-only consent, scope and expiry, revocation, handling of banking data; claims of official connected banks only after live partner validation | BLOCKED EXTERNAL |
| Children and households | Define minimum account age and rules for children/dependants' health details; guardian authorization and restricted sharing; assess COPPA if directed to US under-13 users | POLICY DECISION REQUIRED |
| Security | RLS/owner-only data verification; protected HA credentials, outbound SSRF defense, secrets rotation, penetration review and incident response, verified restoration/backups | PARTIAL |
| Accessibility/support | Working support mailbox, privacy contact, accessible rights request forms and tested Android flows | NOT VERIFIED |
| Incident response | Assign responder, evidence retention, impact assessment, notification routing by applicable region and tested contact channels | DRAFT BELOW |

## Canadian launch
- Assess federal PIPEDA and applicable provincial privacy law by type of entity, collection and provincial users, including Quebec privacy rules if serving Quebec.
- Document meaningful consent and express-sensitive-data consent as required; clear user notice at financial/health-data collection.
- Keep a breach log. Under PIPEDA notify the federal regulator and affected individuals for breaches posing real risk of significant harm, and maintain records of breaches for two years, where PIPEDA applies.
- Assess whether relevant data uses, automated inferences, profiling, AI vendors, cross-border processing and children trigger additional provincial obligations. Do not imply compliance solely from vendor hosting.

## Nigeria
- Confirm application of the Nigeria Data Protection Act 2023 / relevant NDPC instruments, legal responsibility, any registration/filing requirements and data protection impact assessment obligations, including sensitive health and finance information.
- Confirm Mono live connection permissions and policies before collecting real bank credentials or using live bank APIs.
- Establish incident response, rights requests and legitimate international transfer protections.

## United States expansion
- Perform state-by-state applicable consumer and health-data review when launch geography is decided; no blanket claim that a single US federal privacy law covers all use.
- Review FTC Health Breach Notification Rule applicability to Hearth's health-record functionality (it can reach non-HIPAA health apps); do not label Hearth HIPAA-compliant without covered-entity/business-associate analysis.
- If marketing/serving children under 13, evaluate COPPA and verifiable guardian consent; otherwise implement credible age eligibility and child-information handling.

## AI and intelligent home controls
- Document which sensitive data is sent to which LLMs and jurisdictions, contract terms on model training/retention, user control, and scope minimization; remove raw bank identifiers and sensitive unshared health/docs from shared prompts.
- Chief cannot execute smart-home commands through chat; physical device controls require verified owner action and extra sensitive-action confirmation.
- Do not advertise automated bill payment, AI medical diagnosis or bank-verified finance without functionality, appropriate review, agreements and consent.

## Incident response (draft, must be exercised)
1. Triage & contain: lock compromised token/connector, revoke sessions, isolate affected households; do not destroy forensic evidence.
2. Record when detected, affected systems/data categories, scope, individuals/countries, timeline, owner and mitigation; minimize logged PII.
3. Determine legal notice deadlines and thresholds jurisdiction by jurisdiction (e.g. Canada PIPEDA real-risk-of-significant-harm), contact affected individuals/regulators where required.
4. Record user support/rights requests; complete remediation, postmortem and preventive tests.

## Primary references
- Google Play deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Health declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Google Play health: https://support.google.com/googleplay/android-developer/answer/16679511
- Canada's business privacy guidance: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/guide_org/
- Canada breach record/notification: https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/privacy-breaches-at-your-business/gd_pb_201810/
- FTC health app breach guidance: https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule
