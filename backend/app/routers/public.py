"""Anonymous respondent endpoints. No auth: anyone with the link can fill a published form."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..validation import clean_response

router = APIRouter(prefix="/api/public/forms", tags=["public"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


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
    # Look up the uploads this submission refers to (file-upload answers are upload ids).
    question_ids = [q.id for q in form.questions]
    tokens = [value for value in submitted.values() if isinstance(value, str) and len(value) == 32]
    uploads = {
        upload.id: upload
        for upload in db.query(models.Upload)
        .filter(models.Upload.id.in_(tokens), models.Upload.question_id.in_(question_ids))
        .all()
    }
    answers, errors = clean_response(form.questions, submitted, uploads)
    if errors:
        return JSONResponse(
            status_code=422, content={"detail": "Some answers are invalid", "errors": errors}
        )

    response = models.Response(form_id=form.id)
    response.answers = [
        models.Answer(
            question_id=a.question_id,
            value_text=a.value_text,
            value_number=a.value_number,
            option_id=a.option_id,
            upload=a.upload,
        )
        for a in answers
    ]
    db.add(response)
    db.commit()
    return {"id": response.id}


@router.post("/{slug}/questions/{question_id}/uploads", response_model=schemas.UploadOut, status_code=201)
async def upload_file(
    question_id: int,
    file: UploadFile,
    form: models.Form = Depends(get_published_form),
    db: Session = Depends(get_db),
):
    """Store a file for a file-upload question. The returned id is then submitted as the answer."""
    question = next((q for q in form.questions if q.id == question_id), None)
    if question is None or question.type != "file_upload":
        raise HTTPException(404, "This question does not accept files")

    # Read one byte past the limit: enough to know the file is too big without loading all of it.
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Files can be up to 5 MB")
    if not data:
        raise HTTPException(400, "The file is empty")

    upload = models.Upload(
        id=secrets.token_hex(16),
        question_id=question.id,
        filename=(file.filename or "file")[:255],
        content_type=file.content_type or "application/octet-stream",
        size=len(data),
        data=data,
    )
    db.add(upload)
    db.commit()
    return upload
