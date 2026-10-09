"""Creator-facing results: response list, single response, summary stats, CSV export."""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_creator, get_owned_form

router = APIRouter(prefix="/api", tags=["responses"])

TEXT_TYPES = ("short_text", "long_text", "email")
SAMPLE_SIZE = 5


def serialize_response(response: models.Response, questions: list[models.Question]) -> schemas.ResponseOut:
    """Answers in the form's question order, skipping questions that were not answered."""
    by_question = {a.question_id: a for a in response.answers}
    answers = [
        schemas.AnswerOut(
            question_id=q.id, question_title=q.title, question_type=q.type, value=by_question[q.id].value_text
        )
        for q in questions
        if q.id in by_question
    ]
    return schemas.ResponseOut(id=response.id, submitted_at=response.submitted_at, answers=answers)


def load_responses(db: Session, form: models.Form) -> list[models.Response]:
    return (
        db.query(models.Response)
        .options(selectinload(models.Response.answers))
        .filter(models.Response.form_id == form.id)
        .order_by(models.Response.submitted_at.desc())
        .all()
    )


@router.get("/forms/{form_id}/responses", response_model=list[schemas.ResponseOut])
def list_responses(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    return [serialize_response(r, form.questions) for r in load_responses(db, form)]


@router.get("/forms/{form_id}/responses/export")
def export_responses_csv(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Response ID", "Submitted at", *[q.title or "Untitled question" for q in form.questions]])
    for response in load_responses(db, form):
        by_question = {a.question_id: a.value_text for a in response.answers}
        writer.writerow(
            [response.id, response.submitted_at.isoformat(), *[by_question.get(q.id, "") for q in form.questions]]
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="form-{form.id}-responses.csv"'},
    )


@router.get("/forms/{form_id}/stats", response_model=schemas.FormStats)
def form_stats(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    response_count = db.query(func.count(models.Response.id)).filter(models.Response.form_id == form.id).scalar()

    answers_of_form = (
        db.query(models.Answer).join(models.Response).filter(models.Response.form_id == form.id)
    )
    # One grouped query for how often each value was given...
    value_counts: dict[int, dict[str, int]] = {}
    for question_id, value, count in (
        answers_of_form.with_entities(models.Answer.question_id, models.Answer.value_text, func.count())
        .group_by(models.Answer.question_id, models.Answer.value_text)
        .all()
    ):
        value_counts.setdefault(question_id, {})[value] = count
    # ...and one for the numeric aggregates.
    numeric = {
        row[0]: row[1:]
        for row in answers_of_form.with_entities(
            models.Answer.question_id,
            func.avg(models.Answer.value_number),
            func.min(models.Answer.value_number),
            func.max(models.Answer.value_number),
        )
        .group_by(models.Answer.question_id)
        .all()
    }

    questions = []
    for q in form.questions:
        counts = value_counts.get(q.id, {})
        stats = schemas.QuestionStats(question_id=q.id, title=q.title, type=q.type, answered=sum(counts.values()))

        if q.type in models.CHOICE_TYPES:
            labels = [o.label for o in q.options]
        elif q.type == "yes_no":
            labels = ["Yes", "No"]
        elif q.type == "rating":
            labels = [str(n) for n in range(1, int(q.settings.get("max", 5)) + 1)]
        else:
            labels = None

        if labels is not None:
            # Current options first (including ones nobody picked), then any removed options.
            labels += [value for value in counts if value not in labels]
            stats.counts = [schemas.ChoiceCount(label=label, count=counts.get(label, 0)) for label in labels]

        if q.type in ("number", "rating") and q.id in numeric:
            average, minimum, maximum = numeric[q.id]
            stats.average = round(average, 2) if average is not None else None
            stats.minimum, stats.maximum = minimum, maximum

        if q.type in TEXT_TYPES:
            rows = (
                answers_of_form.filter(models.Answer.question_id == q.id)
                .order_by(models.Response.submitted_at.desc())
                .limit(SAMPLE_SIZE)
                .all()
            )
            stats.samples = [a.value_text for a in rows]

        questions.append(stats)

    completion_rate = round(100 * response_count / form.view_count, 1) if form.view_count else None
    return schemas.FormStats(
        response_count=response_count,
        view_count=form.view_count,
        completion_rate=min(completion_rate, 100.0) if completion_rate is not None else None,
        questions=questions,
    )


def get_owned_response(
    response_id: int, db: Session = Depends(get_db), creator: models.Creator = Depends(get_current_creator)
) -> models.Response:
    response = db.get(models.Response, response_id)
    if response is None or response.form.creator_id != creator.id:
        raise HTTPException(404, "Response not found")
    return response


@router.get("/responses/{response_id}", response_model=schemas.ResponseOut)
def get_response(response: models.Response = Depends(get_owned_response)):
    return serialize_response(response, response.form.questions)


@router.delete("/responses/{response_id}", status_code=204)
def delete_response(response: models.Response = Depends(get_owned_response), db: Session = Depends(get_db)):
    db.delete(response)
    db.commit()
    return Response(status_code=204)
