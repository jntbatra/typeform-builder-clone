"""ORM models.

creators 1─* forms 1─* questions 1─* question_options
                              │    1─* logic_rules *─1 questions (jump target)
                  1─* responses 1─* answers *─1 questions
                                    answers 1─0..1 uploads
"""

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    LargeBinary,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

QUESTION_TYPES = (
    "short_text",
    "long_text",
    "multiple_choice",
    "dropdown",
    "email",
    "number",
    "yes_no",
    "rating",
    "file_upload",
)
CHOICE_TYPES = ("multiple_choice", "dropdown")
NUMERIC_TYPES = ("number", "rating")
LOGIC_OPERATORS = ("equals", "not_equals", "contains", "greater_than", "less_than")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Creator(Base):
    __tablename__ = "creators"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)

    forms: Mapped[list["Form"]] = relationship(back_populates="creator")


class Form(Base):
    __tablename__ = "forms"

    id: Mapped[int] = mapped_column(primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creators.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    # Random public identifier used in the share link, so ids are not guessable.
    slug: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | published
    theme: Mapped[dict] = mapped_column(JSON, default=dict)
    thank_you_title: Mapped[str] = mapped_column(String(200), default="Thanks for your time!")
    thank_you_message: Mapped[str] = mapped_column(Text, default="Your response has been recorded.")
    # Times the public form was opened; with the response count this gives a completion rate.
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    creator: Mapped[Creator] = relationship(back_populates="forms")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="form", cascade="all, delete-orphan", order_by="Question.position"
    )
    responses: Mapped[list["Response"]] = relationship(back_populates="form", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    # Type-specific extras, e.g. {"placeholder": "..."} or {"max": 5} for ratings.
    settings: Mapped[dict] = mapped_column(JSON, default=dict)

    form: Mapped[Form] = relationship(back_populates="questions")
    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.position"
    )
    answers: Mapped[list["Answer"]] = relationship(back_populates="question", cascade="all, delete-orphan")
    # Jumps leaving this question, checked in order; the first rule that matches wins.
    logic_rules: Mapped[list["LogicRule"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="LogicRule.position",
        foreign_keys="LogicRule.question_id",
    )


class LogicRule(Base):
    """ "If the answer to `question` <operator> <value>, go to `target_question`"."""

    __tablename__ = "logic_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    operator: Mapped[str] = mapped_column(String(16))
    # What the answer is compared with: text, a number, "yes"/"no", or an option id for choices
    # (an id rather than a label, so renaming an option does not break the rule).
    value: Mapped[str] = mapped_column(String(255), default="")
    # NULL means "skip to the end of the form". CASCADE drops the rule if its target is deleted.
    target_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)

    question: Mapped[Question] = relationship(back_populates="logic_rules", foreign_keys=[question_id])


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(255))
    position: Mapped[int] = mapped_column(Integer, default=0)

    question: Mapped[Question] = relationship(back_populates="options")


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    form: Mapped[Form] = relationship(back_populates="responses")
    answers: Mapped[list["Answer"]] = relationship(back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (UniqueConstraint("response_id", "question_id", name="uq_answer_per_question"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    # Set for choice questions. SET NULL keeps the answer if the option is later removed;
    # value_text still holds the label the respondent actually picked.
    option_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_options.id", ondelete="SET NULL"), nullable=True
    )
    value_text: Mapped[str] = mapped_column(Text, default="")
    # Filled for number and rating answers so stats can be computed in SQL.
    value_number: Mapped[float | None] = mapped_column(Float, nullable=True)

    response: Mapped[Response] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="answers")
    # Set for file-upload answers; value_text then holds the file name.
    upload: Mapped["Upload | None"] = relationship(back_populates="answer", cascade="all, delete-orphan")


class Upload(Base):
    """A file sent for a file-upload question. Stored in the database so it lives with the answer."""

    __tablename__ = "uploads"

    # Random token: the respondent gets it back after uploading and submits it as the answer.
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    # NULL until the response is submitted; then the file is deleted together with its answer.
    answer_id: Mapped[int | None] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE"), nullable=True, unique=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    answer: Mapped[Answer | None] = relationship(back_populates="upload")
