"""Shared FastAPI dependencies."""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Creator, Form, Question

DEFAULT_CREATOR_EMAIL = "creator@formflow.dev"


def get_current_creator(db: Session = Depends(get_db)) -> Creator:
    """Creator auth is out of scope, so every request acts as the seeded default creator.

    Routes depend on this instead of hard-coding an id, so real auth can replace it later
    without touching them.
    """
    creator = db.query(Creator).filter(Creator.email == DEFAULT_CREATOR_EMAIL).first()
    if creator is None:
        raise HTTPException(500, "Default creator is missing; run the seed")
    return creator


def get_owned_form(form_id: int, db: Session = Depends(get_db), creator: Creator = Depends(get_current_creator)) -> Form:
    form = db.get(Form, form_id)
    if form is None or form.creator_id != creator.id:
        raise HTTPException(404, "Form not found")
    return form


def get_owned_question(
    question_id: int, db: Session = Depends(get_db), creator: Creator = Depends(get_current_creator)
) -> Question:
    question = db.get(Question, question_id)
    if question is None or question.form.creator_id != creator.id:
        raise HTTPException(404, "Question not found")
    return question
