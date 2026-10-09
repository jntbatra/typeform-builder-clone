"""Pydantic request and response shapes for the API."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

QuestionType = Literal[
    "short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating"
]


class OptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    label: str
    position: int


class OptionIn(BaseModel):
    # id present = keep/rename an existing option, absent = create a new one.
    id: int | None = None
    label: str = Field(min_length=1, max_length=255)


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: QuestionType
    title: str
    description: str
    required: bool
    position: int
    settings: dict[str, Any]
    options: list[OptionOut]


class QuestionCreate(BaseModel):
    type: QuestionType
    # Insert position; appended to the end when omitted.
    position: int | None = None


class QuestionUpdate(BaseModel):
    type: QuestionType | None = None
    title: str | None = None
    description: str | None = None
    required: bool | None = None
    settings: dict[str, Any] | None = None
    options: list[OptionIn] | None = None


class QuestionOrder(BaseModel):
    question_ids: list[int]


class FormCreate(BaseModel):
    title: str = Field(default="My new form", min_length=1, max_length=200)


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    theme: dict[str, Any] | None = None
    thank_you_title: str | None = Field(default=None, max_length=200)
    thank_you_message: str | None = None


class FormSummary(BaseModel):
    """Row in the dashboard list."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    slug: str
    status: Literal["draft", "published"]
    question_count: int
    response_count: int
    view_count: int
    created_at: datetime
    updated_at: datetime


class FormOut(BaseModel):
    """Full form definition used by the builder."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    slug: str
    status: Literal["draft", "published"]
    theme: dict[str, Any]
    thank_you_title: str
    thank_you_message: str
    view_count: int
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    questions: list[QuestionOut]


class PublicForm(BaseModel):
    """What an anonymous respondent is allowed to see."""

    model_config = ConfigDict(from_attributes=True)
    title: str
    slug: str
    theme: dict[str, Any]
    thank_you_title: str
    thank_you_message: str
    questions: list[QuestionOut]


class AnswerIn(BaseModel):
    question_id: int
    # str for text/email, number for number/rating, option id for choices, bool for yes/no.
    value: Any = None


class ResponseCreate(BaseModel):
    answers: list[AnswerIn]


class AnswerOut(BaseModel):
    question_id: int
    question_title: str
    question_type: QuestionType
    value: str


class ResponseOut(BaseModel):
    id: int
    submitted_at: datetime
    answers: list[AnswerOut]


class ChoiceCount(BaseModel):
    label: str
    count: int


class QuestionStats(BaseModel):
    question_id: int
    title: str
    type: QuestionType
    answered: int
    # Choice, yes/no and rating questions: how many picked each value.
    counts: list[ChoiceCount] = []
    # Number and rating questions.
    average: float | None = None
    minimum: float | None = None
    maximum: float | None = None
    # Text questions: the most recent answers.
    samples: list[str] = []


class FormStats(BaseModel):
    response_count: int
    view_count: int
    completion_rate: float | None
    questions: list[QuestionStats]
