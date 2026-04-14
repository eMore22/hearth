"""
Celery app configuration for Hearth background workers.
"""
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "hearth",
    broker=settings.REDIS_URL or "redis://localhost:6379/0",
    backend=settings.REDIS_URL or "redis://localhost:6379/0",
    include=[
        "app.workers.expiry_monitor",
        "app.workers.bill_monitor",
        "app.workers.meal_planner",
        "app.workers.maintenance_scheduler",
        "app.workers.health_reminder",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
)

# Scheduled tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    # Document expiry monitoring (existing)
    "daily-expiry-check": {
        "task": "expiry_monitor.check_all_documents_expiry",
        "schedule": crontab(hour=9, minute=0),  # Daily 9 AM UTC
    },
    # New tasks
    "weekly-bill-analysis": {
        "task": "bill_monitor.weekly_bill_analysis",
        "schedule": crontab(hour=14, minute=0, day_of_week=1),  # Monday 2 PM UTC
    },
    "monthly-bill-report": {
        "task": "bill_monitor.monthly_bill_report",
        "schedule": crontab(hour=12, minute=0, day_of_month=1),  # 1st of month noon UTC
    },
    "weekly-meal-plan": {
        "task": "meal_planner.generate_weekly_meal_plans",
        "schedule": crontab(hour=18, minute=0, day_of_week=5),  # Friday 6 PM UTC
    },
    "daily-maintenance-check": {
        "task": "maintenance_scheduler.daily_maintenance_check",
        "schedule": crontab(hour=10, minute=0),  # Daily 10 AM UTC
    },
    "daily-health-reminders": {
        "task": "health_reminder.daily_health_reminders",
        "schedule": crontab(hour=8, minute=0),  # Daily 8 AM UTC
    },
}