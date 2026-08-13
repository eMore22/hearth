from fastapi import FastAPI
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
)

app = FastAPI(
    title="Hearth API",
    description="AI Household Operating System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,           prefix="/api/auth",          tags=["Auth"])
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


@app.get("/")
def root():
    return {"status": "Hearth API running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
