"""Server-side validation of a submitted response.

The browser validates too, but anyone can POST to the public endpoint directly,
so the same rules are enforced here before anything is stored.
"""

import re
from dataclasses import dataclass

from .models import CHOICE_TYPES, Question

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_TEXT_LENGTH = 5000


@dataclass
class CleanAnswer:
    """An answer normalised into the columns of the answers table."""

    question_id: int
    value_text: str
    value_number: float | None = None
    option_id: int | None = None


def is_blank(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def clean_answer(question: Question, value) -> CleanAnswer | None:
    """Return the normalised answer, None if it was skipped; raise ValueError if invalid."""
    if is_blank(value):
        if question.required:
            raise ValueError("This question is required")
        return None

    qtype = question.type

    if qtype in ("short_text", "long_text", "email"):
        if not isinstance(value, str):
            raise ValueError("Expected text")
        text = value.strip()
        if len(text) > MAX_TEXT_LENGTH:
            raise ValueError("Answer is too long")
        if qtype == "email" and not EMAIL_RE.match(text):
            raise ValueError("Enter a valid email address")
        return CleanAnswer(question.id, text)

    if qtype == "number":
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError("Enter a number") from None
        if isinstance(value, bool) or number != number or number in (float("inf"), float("-inf")):
            raise ValueError("Enter a number")
        return CleanAnswer(question.id, f"{number:g}", value_number=number)

    if qtype == "rating":
        maximum = int(question.settings.get("max", 5))
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= maximum:
            raise ValueError(f"Choose a rating from 1 to {maximum}")
        return CleanAnswer(question.id, str(value), value_number=float(value))

    if qtype == "yes_no":
        if not isinstance(value, bool):
            raise ValueError("Choose yes or no")
        return CleanAnswer(question.id, "Yes" if value else "No")

    if qtype in CHOICE_TYPES:
        option = next((o for o in question.options if o.id == value), None)
        if option is None:
            raise ValueError("Choose one of the options")
        return CleanAnswer(question.id, option.label, option_id=option.id)

    raise ValueError("Unsupported question type")


def clean_response(questions: list[Question], submitted: dict[int, object]) -> tuple[list[CleanAnswer], dict[int, str]]:
    """Validate every question of a form. Returns (clean answers, errors by question id)."""
    answers: list[CleanAnswer] = []
    errors: dict[int, str] = {}
    for question in questions:
        try:
            answer = clean_answer(question, submitted.get(question.id))
        except ValueError as exc:
            errors[question.id] = str(exc)
            continue
        if answer is not None:
            answers.append(answer)
    return answers, errors
