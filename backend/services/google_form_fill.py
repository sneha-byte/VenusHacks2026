"""Fill the hardcoded UCI post-course Google Form via Playwright."""

from __future__ import annotations

import re
from typing import Any

from pydantic import UUID4

from services.session_service import session_service

UCI_FORM_URL = (
	"https://docs.google.com/forms/d/e/"
	"1FAIpQLSd3CaLvPVyIIKrhzFDCzdI-8W1HbV9MdBUG0qty_9xT6ZmzGQ/viewform"
)


async def _active_page(session_id: UUID4):
	page = session_service.get_active_page(session_id)
	if page is None:
		raise KeyError("No active browser page")
	return page


async def _click_radio_by_label(page, label: str) -> None:
	pattern = re.compile(rf"^{re.escape(label)}$", re.IGNORECASE)
	await page.get_by_role("radio", name=pattern).first.click(timeout=15_000)


async def _click_scale(page, value: str, group_index: int) -> None:
	"""Click scale option 1–5 within the nth radiogroup on the page."""
	groups = page.locator('[role="radiogroup"]')
	group = groups.nth(group_index)
	await group.get_by_role("radio", name=re.compile(rf"^{value}$")).first.click(timeout=15_000)


async def _select_list_option(page, option_text: str, list_index: int = 0) -> None:
	"""Google Forms dropdown: open listbox then pick option."""
	listboxes = page.locator('[role="listbox"]')
	box = listboxes.nth(list_index)
	await box.click(timeout=10_000)
	await page.get_by_role("option", name=re.compile(re.escape(option_text), re.I)).first.click(
		timeout=15_000
	)


async def _click_submit(page) -> bool:
	"""Click the Google Form submit control and wait for confirmation."""
	candidates = [
		page.get_by_role("button", name=re.compile(r"submit", re.I)),
		page.locator('[role="button"]').filter(has_text=re.compile(r"^\s*submit\s*$", re.I)),
		page.locator("span").filter(has_text=re.compile(r"^\s*submit\s*$", re.I)),
	]
	for locator in candidates:
		if await locator.count() == 0:
			continue
		await locator.first.click(timeout=15_000)
		try:
			await page.get_by_text(
				re.compile(
					r"response has been recorded|thanks for submitting|your response has been submitted",
					re.I,
				)
			).first.wait_for(state="visible", timeout=25_000)
			return True
		except Exception:
			if "formResponse" in page.url or "viewform=closed" in page.url:
				return True
	return False


async def fill_uci_post_course_form(session_id: UUID4, answers: dict[str, Any]) -> dict[str, Any]:
	await session_service.ensure_session(session_id)
	page = await _active_page(session_id)
	await page.goto(UCI_FORM_URL, wait_until="domcontentloaded", timeout=60_000)
	await page.wait_for_timeout(1500)

	email = str(answers.get("email", "")).strip()
	if email:
		await page.locator('input[type="email"]').first.fill(email, timeout=15_000)

	consent = str(answers.get("research_consent", "Yes"))
	await _click_radio_by_label(page, consent)

	# Scale questions map to radiogroup order on the form (after consent).
	scale_ids = [
		"academic_confidence",
		"stress",
		"resources_confidence",
		"skills_understanding",
		"time_management",
		"goals_comfort",
	]
	for i, qid in enumerate(scale_ids):
		val = str(answers.get(qid, "")).strip()
		if val:
			await _click_scale(page, val, group_index=i + 1)

	await _select_list_option(page, str(answers.get("overall_experience", "Good")), list_index=0)
	await _select_list_option(page, str(answers.get("organization", "Neutral")), list_index=1)
	await _select_list_option(
		page, str(answers.get("assignments_helpful", "Helpful")), list_index=2
	)

	feedback = str(answers.get("additional_feedback", "")).strip()
	if feedback and feedback != "(skipped)":
		textareas = page.locator("textarea")
		if await textareas.count() > 0:
			await textareas.last.fill(feedback, timeout=15_000)

	submitted = await _click_submit(page)
	if not submitted:
		raise RuntimeError("Form was filled but Submit could not be confirmed.")

	return {"ok": True, "url": page.url, "submitted": True}
