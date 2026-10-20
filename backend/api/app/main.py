from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from app.services.ha_credentials import migrate_active_ha_credentials

startup_logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only encrypt saved HA tokens; no commands are sent to real hardware.
    # Failed migrations cannot bypass the fail-closed credential read path.
    try:
        result = await run_in_threadpool(migrate_active_ha_credentials)
        startup_logger.info("HA encryption migration summary: %s", result)
    except Exception:
        startup_logger.warning("HA encryption migration deferred")
    yield
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    auth,
    household,
    documents,
    bills,
    grocery,
    maintenance,
    health,
    notifications,
    chief_of_staff,
    automation,
    intake,
    tasks,
    billing,
    finance,
    utilities,
    nigeria_sandbox,
    mono_webhooks,
    account_deletion,
)

app = FastAPI(
    title="Hearth API",
    description="AI Household Operating System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,           prefix="/api/auth",          tags=["Auth"])
app.include_router(account_deletion.router, prefix="/api/auth", tags=["Account deletion"])
app.include_router(household.router,      prefix="/api/household",     tags=["Household"])
app.include_router(documents.router,      prefix="/api/documents",     tags=["Documents"])
app.include_router(bills.router,          prefix="/api/bills",         tags=["Bills"])
app.include_router(grocery.router,        prefix="/api/grocery",       tags=["Grocery"])
app.include_router(maintenance.router,    prefix="/api/maintenance",   tags=["Maintenance"])
app.include_router(health.router,         prefix="/api/health",        tags=["Health"])
app.include_router(notifications.router,  prefix="/api/notifications", tags=["Notifications"])
app.include_router(chief_of_staff.router, prefix="/api/chief",         tags=["ChiefOfStaff"])
app.include_router(automation.router,     prefix="/api/automation",    tags=["Automation"])
app.include_router(intake.router,         prefix="/api/intake",        tags=["Intake"])
app.include_router(tasks.router,          prefix="/api/tasks",         tags=["Tasks"])
app.include_router(billing.router,        prefix="/api/billing",       tags=["Billing"])
app.include_router(finance.router,        prefix="/api/finance",       tags=["Finance"])
app.include_router(utilities.router,      prefix="/api/utilities",     tags=["Utilities"])
app.include_router(nigeria_sandbox.router,prefix="/api/finance/sandbox/mono",tags=["NigeriaSandbox"])
app.include_router(mono_webhooks.router, prefix="/api/webhooks", tags=["MonoSandboxWebhook"])


@app.get("/")
def root():
    return {"status": "Hearth API running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/account-deletion", response_class=HTMLResponse, include_in_schema=False)
def account_deletion():
    """Public account-deletion request path for users without app access."""
    return """<!doctype html><html lang='en'><head><meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,initial-scale=1'>
    <title>Hearth HQ – Delete account</title></head><body style='font:16px system-ui;max-width:650px;margin:8vh auto;padding:24px;line-height:1.6'>
    <h1>Delete your Hearth HQ account</h1><p>To request deletion of your Hearth HQ account and associated household data,
    email <a href='mailto:support@hearthhq.online?subject=Hearth%20HQ%20account%20deletion%20request'>support@hearthhq.online</a>
    from your account email address with the subject <strong>Hearth HQ account deletion request</strong>.</p>
    <p>We will verify account ownership before processing the request. Include no passwords or private documents in the email.
    If you have a Google Play subscription, cancel it separately in Google Play to stop future renewals.</p>
    <p>If any information must be retained for legal, security, or billing reasons, we will explain what is retained and why.</p></body></html>"""
