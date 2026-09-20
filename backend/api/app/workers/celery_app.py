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
        "app.workers.task_reminder",
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

# Every task name below now exactly matches its @celery_app.task/@shared_task
# decorator name in the actual worker file — 6 of 7 were mismatched before,
# meaning Beat was sending messages no registered task ever received.
#
# The five daily/weekly/monthly tasks now run HOURLY. Each one loops over
# every household and calls is_local_target_time() (timezone_utils.py) to
# decide whether "now" is that household's actual local target hour/day —
# so households in different timezones each get notified once at a sensible
# local time instead of everyone firing at the same fixed UTC instant.
celery_app.conf.beat_schedule = {
    "hourly-expiry-check": {
        "task": "expiry_monitor.check_all_expiries",
        "schedule": crontab(minute=0),
    },
    "hourly-bill-weekly-analysis": {
        "task": "bill_monitor.weekly_analysis",
        "schedule": crontab(minute=0),
    },
    "hourly-bill-monthly-report": {
        "task": "bill_monitor.monthly_report",
        "schedule": crontab(minute=0),
    },
    "hourly-weekly-meal-plan": {
        "task": "grocery.weekly_meal_plan",
        "schedule": crontab(minute=0),
    },
    "hourly-maintenance-check": {
        "task": "maintenance.daily_check",
        "schedule": crontab(minute=0),
    },
    "hourly-health-reminders": {
        "task": "health.daily_reminders",
        "schedule": crontab(minute=0),
    },
    "check-due-tasks": {
        "task": "tasks.check_due_tasks",
        "schedule": crontab(minute="*/15"),
    },
}
