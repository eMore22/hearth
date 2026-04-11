from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "hearth_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.beat_schedule = {
    # Run expiry check every day at 8am UTC
    "check-document-expiries": {
        "task": "app.workers.expiry_monitor.check_all_expiries",
        "schedule": crontab(hour=8, minute=0),
    },
    # Generate weekly meal plans every Sunday at 7am UTC
    "generate-meal-plans": {
        "task": "app.workers.meal_planner.generate_all_meal_plans",
        "schedule": crontab(day_of_week=0, hour=7, minute=0),
    },
}

celery_app.conf.timezone = "UTC"
