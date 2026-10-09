"""Logic jumps: which questions a respondent actually sees, given their answers.

The browser runs the same algorithm (frontend/lib/logic.ts) to move between questions.
The server repeats it on submit so that questions a jump skipped are not treated as
missing, and answers to questions that were never shown are ignored.
"""

from .models import NUMERIC_TYPES, LogicRule, Question


def is_blank(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def comparable(question: Question, value) -> str | float | None:
    """The answer in the form rules are written in: a number, "yes"/"no", or lower-case text.

    For choice questions the submitted value is the option id, so the text is that id.
    """
    if is_blank(value):
        return None
    if question.type == "yes_no":
        return "yes" if value is True else "no"
    if question.type in NUMERIC_TYPES:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    return str(value).strip().lower()


def rule_matches(rule: LogicRule, question: Question, value) -> bool:
    answer = comparable(question, value)
    if answer is None:
        return False

    if isinstance(answer, float):
        try:
            expected: str | float = float(rule.value)
        except ValueError:
            return False
    else:
        expected = rule.value.strip().lower()

    if rule.operator == "equals":
        return answer == expected
    if rule.operator == "not_equals":
        return answer != expected
    if rule.operator == "contains":
        return isinstance(answer, str) and str(expected) in answer
    if rule.operator == "greater_than":
        return isinstance(answer, float) and answer > expected
    if rule.operator == "less_than":
        return isinstance(answer, float) and answer < expected
    return False


def visited_questions(questions: list[Question], submitted: dict[int, object]) -> list[Question]:
    """Walk the form from the first question, following the first matching rule at each step."""
    index_of = {question.id: index for index, question in enumerate(questions)}
    visited: list[Question] = []
    index = 0
    while index < len(questions):
        question = questions[index]
        visited.append(question)
        next_index = index + 1
        for rule in question.logic_rules:
            if not rule_matches(rule, question, submitted.get(question.id)):
                continue
            if rule.target_question_id is None:
                return visited  # jump to the end of the form
            target = index_of.get(rule.target_question_id)
            # Only forward jumps are followed, so a form can never loop.
            if target is not None and target > index:
                next_index = target
                break
        index = next_index
    return visited
