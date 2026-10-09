"""Sample data so the app is usable straight after setup.

Runs automatically on first start (empty database). Run `python -m app.seed --reset`
to wipe and re-create it.
"""

import random
import sys
from datetime import timedelta

from sqlalchemy.orm import Session

from . import models
from .database import Base, SessionLocal, engine
from .deps import DEFAULT_CREATOR_EMAIL
from .logic import visited_questions

# (type, title, description, required, options or rating max)
FEEDBACK_QUESTIONS = [
    ("short_text", "First off, what's your name?", "", True, None),
    ("email", "And your email address?", "We'll only use it to follow up on your feedback.", True, None),
    ("rating", "How would you rate your overall experience?", "1 is poor, 5 is excellent.", True, 5),
    ("multiple_choice", "Which feature do you use the most?", "", True,
     ["Dashboard", "Reports", "Integrations", "Mobile app"]),
    ("yes_no", "Would you recommend us to a friend?", "", True, None),
    ("dropdown", "How did you hear about us?", "", False,
     ["Search engine", "Social media", "A friend or colleague", "Blog or newsletter", "Other"]),
    ("number", "How many people are on your team?", "", False, None),
    ("long_text", "Anything else you'd like us to know?", "Suggestions, complaints, kind words. All welcome.", False, None),
]

EVENT_QUESTIONS = [
    ("short_text", "What's your full name?", "", True, None),
    ("email", "Where should we send your ticket?", "", True, None),
    ("multiple_choice", "Which track are you most excited about?", "", True,
     ["Frontend", "Backend", "AI and data", "Design"]),
    ("dropdown", "T-shirt size", "Every attendee gets one.", False, ["S", "M", "L", "XL"]),
    ("number", "How many years have you been coding?", "", False, None),
    ("yes_no", "Will you join the after-party?", "", True, None),
    ("rating", "How excited are you?", "", False, 5),
]

JOB_QUESTIONS = [
    ("short_text", "What's your name?", "", True, None),
    ("email", "Your email", "", True, None),
    ("dropdown", "Which role are you applying for?", "", True,
     ["Frontend Engineer", "Backend Engineer", "Product Designer"]),
    ("long_text", "Tell us about a project you're proud of.", "", True, None),
    ("file_upload", "Attach your résumé", "PDF or Word, up to 5 MB.", False, None),
]

NAMES = ["Aarav Mehta", "Diya Kapoor", "Kabir Singh", "Meera Nair", "Rohan Gupta", "Sara Khan",
         "Vivaan Joshi", "Ananya Rao", "Ishaan Verma", "Tara Bose", "Neil D'Souza", "Zoya Ali",
         "Arjun Reddy", "Kiara Shah"]
COMMENTS = [
    "Really smooth onboarding, I was up and running in minutes.",
    "The reports page could load faster on large accounts.",
    "Would love a dark mode!",
    "Support replied within an hour. Impressive.",
    "Integrations with our CRM saved us a lot of manual work.",
    "",
    "",
]


def build_form(creator, title, question_specs, status):
    form = models.Form(creator_id=creator.id, title=title, slug="", status=status, theme={})
    for position, (qtype, qtitle, description, required, extra) in enumerate(question_specs):
        question = models.Question(
            type=qtype, title=qtitle, description=description, required=required, position=position,
            settings={"max": extra} if qtype == "rating" else {},
        )
        if qtype in models.CHOICE_TYPES:
            question.options = [models.QuestionOption(label=label, position=i) for i, label in enumerate(extra)]
        form.questions.append(question)
    return form


def fake_answer(rng: random.Random, question: models.Question, name: str) -> models.Answer | None:
    """One plausible answer; optional questions are sometimes skipped."""
    if not question.required and rng.random() < 0.25:
        return None
    qtype = question.type
    if qtype == "short_text":
        return models.Answer(value_text=name)
    if qtype == "email":
        return models.Answer(value_text=name.lower().replace(" ", ".").replace("'", "") + "@example.com")
    if qtype == "long_text":
        text = rng.choice(COMMENTS)
        return models.Answer(value_text=text) if text else None
    if qtype == "number":
        number = rng.randint(1, 40)
        return models.Answer(value_text=str(number), value_number=float(number))
    if qtype == "rating":
        rating = rng.choices([1, 2, 3, 4, 5], weights=[1, 1, 3, 6, 5])[0]
        return models.Answer(value_text=str(rating), value_number=float(rating))
    if qtype == "yes_no":
        return models.Answer(value_text="Yes" if rng.random() < 0.75 else "No")
    if qtype == "file_upload":
        return None
    option = rng.choice(question.options)
    return models.Answer(value_text=option.label, option_id=option.id)


def submitted_value(question: models.Question, answer: models.Answer):
    """The value a browser would have sent for this stored answer (what logic rules compare)."""
    if question.type in models.CHOICE_TYPES:
        return answer.option_id
    if question.type == "yes_no":
        return answer.value_text == "Yes"
    if question.type in models.NUMERIC_TYPES:
        return answer.value_number
    return answer.value_text


def add_responses(db: Session, rng: random.Random, form: models.Form, count: int) -> None:
    now = models.utcnow()
    for name in rng.sample(NAMES, count):
        response = models.Response(
            form_id=form.id, submitted_at=now - timedelta(hours=rng.randint(1, 240), minutes=rng.randint(0, 59))
        )
        drafted = {q.id: fake_answer(rng, q, name) for q in form.questions}
        submitted = {q.id: submitted_value(q, drafted[q.id]) for q in form.questions if drafted[q.id]}
        # Keep only the questions this respondent would have been shown, given the logic jumps.
        for question in visited_questions(form.questions, submitted):
            answer = drafted[question.id]
            if answer is not None:
                answer.question_id = question.id
                response.answers.append(answer)
        db.add(response)
    form.view_count = count + rng.randint(3, 9)


def seed(db: Session) -> None:
    rng = random.Random(7)  # fixed seed: the sample data is the same on every machine
    creator = models.Creator(name="Default Creator", email=DEFAULT_CREATOR_EMAIL)
    db.add(creator)
    db.flush()

    feedback = build_form(creator, "Customer Feedback Survey", FEEDBACK_QUESTIONS, "published")
    event = build_form(creator, "DevConf 2026 Registration", EVENT_QUESTIONS, "published")
    job = build_form(creator, "Job Application", JOB_QUESTIONS, "draft")
    # Fixed slugs for the seeded forms keep the demo links stable across re-seeds.
    feedback.slug, event.slug, job.slug = "feedback", "devconf", "job-application"
    feedback.published_at = event.published_at = models.utcnow()
    db.add_all([feedback, event, job])
    db.flush()  # assigns ids to questions and options, needed by the rules and answers below

    # Logic jumps on the feedback form: unhappy respondents go straight to the open comment.
    rating, recommend, comment = feedback.questions[2], feedback.questions[4], feedback.questions[7]
    rating.logic_rules.append(models.LogicRule(operator="less_than", value="3", target_question_id=comment.id))
    recommend.logic_rules.append(models.LogicRule(operator="equals", value="no", target_question_id=comment.id))
    db.flush()

    add_responses(db, rng, feedback, 14)
    add_responses(db, rng, event, 9)
    db.commit()


def seed_if_empty() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(models.Creator).first() is None:
            seed(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    seed_if_empty()
    print("Database ready.")
