"""Server-side validation of a submitted response.

The browser validates too, but anyone can POST to the public endpoint directly,
so the same rules are enforced here before anything is stored.
"""

import re
from dataclasses import dataclass

from .logic import is_blank, visited_questions
from .models import CHOICE_TYPES, Question, Upload

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_TEXT_LENGTH = 5000


@dataclass
class CleanAnswer:
    """An answer normalised into the columns of the answers table."""

    question_id: int
    value_text: str
    value_number: float | None = None
    option_id: int | None = None
    upload: Upload | None = None


def clean_answer(question: Question, value, uploads: dict[str, Upload]) -> CleanAnswer | None:
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

    if qtype == "file_upload":
        # The file was sent earlier; the answer is the id that upload returned.
        upload = uploads.get(value) if isinstance(value, str) else None
        if upload is None or upload.question_id != question.id or upload.answer_id is not None:
            raise ValueError("Upload the file again")
        return CleanAnswer(question.id, upload.filename, upload=upload)

    raise ValueError("Unsupported question type")


def clean_response(
    questions: list[Question], submitted: dict[int, object], uploads: dict[str, Upload]
) -> tuple[list[CleanAnswer], dict[int, str]]:
    """Validate a submission. Returns (clean answers, errors by question id).

    Only the questions on the respondent's path through the logic jumps are checked and kept.
    `uploads` maps upload id to the pending uploads of this form.
    """
    answers: list[CleanAnswer] = []
    errors: dict[int, str] = {}
    for question in visited_questions(questions, submitted):
        try:
            answer = clean_answer(question, submitted.get(question.id), uploads)
        except ValueError as exc:
            errors[question.id] = str(exc)
            continue
        if answer is not None:
            answers.append(answer)
    return answers, errors
