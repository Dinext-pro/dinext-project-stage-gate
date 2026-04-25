# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

from datetime import date

from erpnext.projects.doctype.project.project import get_holiday_list
from erpnext.setup.doctype.holiday_list.holiday_list import is_holiday
from frappe.utils import add_days, getdate


def resolve_holiday_list(project) -> str | None:
	"""Project.holiday_list or Company.default_holiday_list via ERPNext helper."""
	if getattr(project, "holiday_list", None):
		return project.holiday_list
	return get_holiday_list(project.company)


def first_working_day_on_or_after(holiday_list: str | None, d: date | str) -> date:
	"""First calendar day on or after ``d`` that is not in the holiday list."""
	cur = getdate(d)
	while holiday_list and is_holiday(holiday_list, cur):
		cur = add_days(cur, 1)
	return cur


def next_working_day_after(holiday_list: str | None, d: date | str) -> date:
	"""First working day strictly after calendar date ``d``."""
	return first_working_day_on_or_after(holiday_list, add_days(getdate(d), 1))


def planned_end_from_duration(
	planned_start: date | str,
	duration_days: int | None,
	holiday_list: str | None,
) -> date:
	"""
	Inclusive working-day span: ``duration_days`` working days including ``planned_start``.
	Non-positive or missing duration → end equals start.
	"""
	start = getdate(planned_start)
	dur = int(duration_days or 0)
	if dur <= 0:
		return start
	current = start
	for _ in range(dur - 1):
		current = next_working_day_after(holiday_list, current)
	return current
