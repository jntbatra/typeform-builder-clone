"""Anonymous respondent endpoints. No auth: anyone with the link can fill a published form."""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..validation import clean_response

router = APIRouter(prefix="/api/public/forms", tags=["public"])


def get_published_form(slug: str, db: Session = Depends(get_db)) -> models.Form:
    form = db.query(models.Form).filter(models.Form.slug == slug).first()
    # Drafts answer 404 as well, so an unpublished link reveals nothing.
    if form is None or form.status != "published":
        raise HTTPException(404, "This form is not available")
    return form


@router.get("/{slug}", response_model=schemas.PublicForm)
def get_public_form(form: models.Form = Depends(get_published_form)):
    return form


@router.post("/{slug}/views", status_code=204)
def record_view(form: models.Form = Depends(get_published_form), db: Session = Depends(get_db)):
    """Called once when a respondent opens the form; feeds the completion rate."""
    # Increment in SQL so two simultaneous views cannot overwrite each other.
    db.query(models.Form).filter(models.Form.id == form.id).update(
        {models.Form.view_count: models.Form.view_count + 1, models.Form.updated_at: form.updated_at}
    )
    db.commit()
    return Response(status_code=204)


@router.post("/{slug}/responses", status_code=201)
def submit_response(
    payload: schemas.ResponseCreate, form: models.Form = Depends(get_published_form), db: Session = Depends(get_db)
):
    submitted = {answer.question_id: answer.value for answer in payload.answers}
    answers, errors = clean_response(form.questions, submitted)
    if errors:
        return JSONResponse(
            status_code=422, content={"detail": "Some answers are invalid", "errors": errors}
        )

    response = models.Response(form_id=form.id)
    response.answers = [
        models.Answer(
            question_id=a.question_id, value_text=a.value_text, value_number=a.value_number, option_id=a.option_id
        )
        for a in answers
    ]
    db.add(response)
    db.commit()
    return {"id": response.id}
