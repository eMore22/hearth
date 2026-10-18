"""Provider capabilities for Canadian and Nigerian household utilities.

A catalog is not a provider connection. Never imply that a meter or bill was
pulled until a provider has authorized and returned actual data.
"""
from typing import Literal

PROVIDERS = {
    "CA": [
        {"id": "ca-ontario-green-button", "name": "Ontario Green Button",
         "services": ["electricity","gas"], "coverage": "Participating Ontario utilities",
         "method": "green_button_connect_my_data",
         "registration_required": True, "consent_required": True,
         "automatic_pull_enabled": False,
         "note": "Third-party registration, explicit customer authorization and a provider-specific adapter are required.",
         "reference": "https://www.oeb.ca/consumer-information-and-protection/green-button"},
        {"id": "ca-other-utilities", "name": "Other Canadian providers",
         "services": ["electricity","gas","water","internet","television"],
         "coverage": "Canada, provider dependent", "method": "manual_household_bill",
         "registration_required": False, "consent_required": False,
         "automatic_pull_enabled": False,
         "note": "Manually recorded household bills are available now; direct provider imports require individual integrations.",
         "reference": None},
    ],
    "NG": [
        {"id": "ng-vtpass-electricity", "name": "VTpass electricity",
         "services": ["electricity"], "coverage": "Participating Nigerian electricity distributors",
         "method": "vtpass_sandbox_meter_check",
         "registration_required": True, "consent_required": True,
         "automatic_pull_enabled": False,
         "note": "Sandbox meter verification is for approved testers only. It does not sync real bills or make payments.",
         "reference": "https://www.vtpass.com/documentation/introduction/"},
        {"id": "ng-other-utilities", "name": "Other Nigerian providers",
         "services": ["electricity","water","internet","gas","television"],
         "coverage": "Nigeria, provider dependent", "method": "manual_household_bill",
         "registration_required": False, "consent_required": False,
         "automatic_pull_enabled": False,
         "note": "Manually recorded household bills are available now.",
         "reference": None},
    ],
}


def utility_provider_capabilities(country: Literal["CA","NG"]) -> dict:
    if country not in PROVIDERS:
        raise ValueError("Unsupported country")
    return {
        "country": country, "provider_connections": PROVIDERS[country],
        "household_shared_bills": True, "bank_balances_shared": False,
        "provider_automatic_pull_enabled": False, "payment_execution_enabled": False,
        "data_provenance": "provider catalog only; no provider credentials or live meter records",
    }
