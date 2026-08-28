"""
Shared helpers for running Celery Beat tasks at the right *local* hour per
household, without needing per-household dynamic Celery schedules (that
would require extra infrastructure like Redbeat). Each daily/weekly/monthly
task instead runs HOURLY (see celery_app.py) and calls is_local_target_time()
per household to decide whether "now" is that household's target local hour.
"""
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo

DEFAULT_TIMEZONE = "UTC"


def get_local_now(tz_name: str = None) -> datetime:
    """
    Current time in the given IANA timezone. Falls back to UTC for missing
    or invalid values — e.g. households created before timezone selection
    existed, or a bad/typo'd zone name.
    """
    try:
        tz = ZoneInfo(tz_name) if tz_name else ZoneInfo(DEFAULT_TIMEZONE)
    except Exception:
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    return datetime.now(dt_timezone.utc).astimezone(tz)


def is_local_target_time(
    tz_name: str = None,
    target_hour: int = 9,
    target_weekday: int = None,       # Monday=0 ... Sunday=6, matches datetime.weekday()
    target_day_of_month: int = None,
) -> bool:
    """
    True exactly once per matching local hour (and, if given, local weekday
    or day-of-month) for this household's timezone. Callers run hourly via
    Beat and call this per household to decide whether to act "now".
    """
    local_now = get_local_now(tz_name)
    if local_now.hour != target_hour:
        return False
    if target_weekday is not None and local_now.weekday() != target_weekday:
        return False
    if target_day_of_month is not None and local_now.day != target_day_of_month:
        return False
    return True
