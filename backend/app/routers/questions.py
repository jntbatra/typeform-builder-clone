"""Builder operations on a form's questions: add, edit, reorder, delete."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_owned_form, get_owned_question

router = APIRouter(prefix="/api", tags=["questions"])

DEFAULT_OPTIONS = ("Choice 1", "Choice 2")


def apply_type_defaults(question: models.Question) -> None:
    """Make a question's options and settings consistent with its type."""
    if question.type in models.CHOICE_TYPES:
        if not question.options:
            question.options = [
                models.QuestionOption(label=label, position=i) for i, label in enumerate(DEFAULT_OPTIONS)
            ]
    else:
        question.options = []
    if question.type == "rating" and "max" not in question.settings:
        question.settings = {**question.settings, "max": 5}


def renumber(questions: list[models.Question]) -> None:
    for index, question in enumerate(questions):
        question.position = index


@router.post("/forms/{form_id}/questions", response_model=schemas.QuestionOut, status_code=201)
def add_question(
    payload: schemas.QuestionCreate, form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)
):
    question = models.Question(type=payload.type, title="", description="", settings={})
    apply_type_defaults(question)
    ordered = list(form.questions)
    index = len(ordered) if payload.position is None else max(0, min(payload.position, len(ordered)))
    ordered.insert(index, question)
    form.questions = ordered
    renumber(ordered)
    form.updated_at = models.utcnow()
    db.commit()
    return question


@router.put("/forms/{form_id}/questions/order", response_model=list[schemas.QuestionOut])
def reorder_questions(
    payload: schemas.QuestionOrder, form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)
):
    """Persist a drag-and-drop reorder. The body must list every question id exactly once."""
    by_id = {q.id: q for q in form.questions}
    if sorted(payload.question_ids) != sorted(by_id):
        raise HTTPException(400, "question_ids must contain each question of the form exactly once")
    ordered = [by_id[qid] for qid in payload.question_ids]
    renumber(ordered)
    # Jumps only go forward, so drop any rule whose target is no longer after its question.
    for question in ordered:
        question.logic_rules = [
            rule
            for rule in question.logic_rules
            if rule.target_question_id is None or by_id[rule.target_question_id].position > question.position
        ]
    form.updated_at = models.utcnow()
    db.commit()
    return ordered


@router.patch("/questions/{question_id}", response_model=schemas.QuestionOut)
def update_question(
    payload: schemas.QuestionUpdate,
    question: models.Question = Depends(get_owned_question),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True, exclude={"options", "logic_rules"})
    if "type" in data and data["type"] != question.type:
        # Rules are written for one answer type; they make no sense for another.
        question.logic_rules = []
    for field, value in data.items():
        setattr(question, field, value)

    if payload.logic_rules is not None:
        # A rule may only jump forward, to a later question of the same form (or to the end).
        later = {q.id for q in question.form.questions if q.position > question.position}
        for rule in payload.logic_rules:
            if rule.target_question_id is not None and rule.target_question_id not in later:
                raise HTTPException(400, "A jump must go to a later question of the same form")
        question.logic_rules = [
            models.LogicRule(
                operator=rule.operator, value=rule.value, target_question_id=rule.target_question_id, position=i
            )
            for i, rule in enumerate(payload.logic_rules)
        ]

    if payload.options is not None and question.type in models.CHOICE_TYPES:
        # Sync by id so existing options keep their id (and the answers pointing at them).
        existing = {o.id: o for o in question.options}
        synced = []
        for position, item in enumerate(payload.options):
            option = existing.get(item.id) if item.id is not None else None
            if option is None:
                option = models.QuestionOption(label=item.label)
            option.label = item.label
            option.position = position
            synced.append(option)
        question.options = synced

    apply_type_defaults(question)
    question.form.updated_at = models.utcnow()
    db.commit()
    return question


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(question: models.Question = Depends(get_owned_question), db: Session = Depends(get_db)):
    form = question.form
    form.questions.remove(question)
    renumber(form.questions)
    form.updated_at = models.utcnow()
    db.commit()
    return Response(status_code=204)
