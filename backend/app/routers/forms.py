"""Creator-facing form management: CRUD, duplicate, publish."""

import secrets

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_creator, get_owned_form

router = APIRouter(prefix="/api/forms", tags=["forms"])


def new_slug() -> str:
    return secrets.token_urlsafe(6)


@router.get("", response_model=list[schemas.FormSummary])
def list_forms(db: Session = Depends(get_db), creator: models.Creator = Depends(get_current_creator)):
    # Counts come from correlated subqueries so the list is one query, not one per form.
    question_count = (
        db.query(func.count(models.Question.id))
        .filter(models.Question.form_id == models.Form.id)
        .correlate(models.Form)
        .scalar_subquery()
    )
    response_count = (
        db.query(func.count(models.Response.id))
        .filter(models.Response.form_id == models.Form.id)
        .correlate(models.Form)
        .scalar_subquery()
    )
    rows = (
        db.query(models.Form, question_count, response_count)
        .filter(models.Form.creator_id == creator.id)
        .order_by(models.Form.updated_at.desc())
        .all()
    )
    return [
        schemas.FormSummary(
            id=form.id,
            title=form.title,
            slug=form.slug,
            status=form.status,
            question_count=questions,
            response_count=responses,
            view_count=form.view_count,
            created_at=form.created_at,
            updated_at=form.updated_at,
        )
        for form, questions, responses in rows
    ]


@router.post("", response_model=schemas.FormOut, status_code=201)
def create_form(
    payload: schemas.FormCreate,
    db: Session = Depends(get_db),
    creator: models.Creator = Depends(get_current_creator),
):
    form = models.Form(creator_id=creator.id, title=payload.title, slug=new_slug(), theme={})
    db.add(form)
    db.commit()
    return form


@router.get("/{form_id}", response_model=schemas.FormOut)
def get_form(form: models.Form = Depends(get_owned_form)):
    return form


@router.patch("/{form_id}", response_model=schemas.FormOut)
def update_form(
    payload: schemas.FormUpdate, form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(form, field, value)
    db.commit()
    return form


@router.delete("/{form_id}", status_code=204)
def delete_form(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    db.delete(form)
    db.commit()
    return Response(status_code=204)


@router.post("/{form_id}/duplicate", response_model=schemas.FormOut, status_code=201)
def duplicate_form(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    """Copy the definition (questions and options) as a new draft. Responses are not copied."""
    copy = models.Form(
        creator_id=form.creator_id,
        title=f"{form.title} (copy)",
        slug=new_slug(),
        theme=dict(form.theme),
        thank_you_title=form.thank_you_title,
        thank_you_message=form.thank_you_message,
    )
    for question in form.questions:
        copy.questions.append(
            models.Question(
                type=question.type,
                title=question.title,
                description=question.description,
                required=question.required,
                position=question.position,
                settings=dict(question.settings),
                options=[models.QuestionOption(label=o.label, position=o.position) for o in question.options],
            )
        )
    db.add(copy)
    db.commit()
    return copy


@router.post("/{form_id}/publish", response_model=schemas.FormOut)
def publish_form(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    form.status = "published"
    form.published_at = models.utcnow()
    db.commit()
    return form


@router.post("/{form_id}/unpublish", response_model=schemas.FormOut)
def unpublish_form(form: models.Form = Depends(get_owned_form), db: Session = Depends(get_db)):
    form.status = "draft"
    db.commit()
    return form
