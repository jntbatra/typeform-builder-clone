// Everything the UI needs to know about each question type, in one place.

import type { Answers, AnswerValue, Question, QuestionType } from "./types";

export interface QuestionTypeMeta {
  label: string;
  /** Short glyph shown in the coloured tile next to a question. */
  glyph: string;
  /** Tile background, grouped by family like Typeform (text, choice, contact, number). */
  color: string;
  placeholder: string;
}

export const QUESTION_TYPES: Record<QuestionType, QuestionTypeMeta> = {
  short_text: { label: "Short Text", glyph: "—", color: "#b9d8f5", placeholder: "Type your answer here..." },
  long_text: { label: "Long Text", glyph: "≡", color: "#b9d8f5", placeholder: "Type your answer here..." },
  multiple_choice: { label: "Multiple Choice", glyph: "✓", color: "#e3c8f0", placeholder: "" },
  dropdown: { label: "Dropdown", glyph: "⌄", color: "#e3c8f0", placeholder: "Type or select an option" },
  yes_no: { label: "Yes/No", glyph: "◐", color: "#e3c8f0", placeholder: "" },
  email: { label: "Email", glyph: "@", color: "#bfe6cf", placeholder: "name@example.com" },
  number: { label: "Number", glyph: "#", color: "#f7dc9c", placeholder: "Type your answer here..." },
  rating: { label: "Rating", glyph: "★", color: "#f9c9b4", placeholder: "" },
};

export const QUESTION_TYPE_ORDER = Object.keys(QUESTION_TYPES) as QuestionType[];

export const isChoiceType = (type: QuestionType) => type === "multiple_choice" || type === "dropdown";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const isBlank = (value: AnswerValue) => value === null || value === undefined || String(value).trim() === "";

/** Client-side check for one answer. Mirrors backend/app/validation.py; the server re-checks. */
export function validateAnswer(question: Question, value: AnswerValue): string | null {
  if (isBlank(value)) return question.required ? "Please fill this in" : null;
  if (question.type === "email" && !EMAIL_RE.test(String(value).trim())) {
    return "Hmm... that email doesn't look right";
  }
  if (question.type === "number" && !Number.isFinite(Number(value))) return "Numbers only please";
  return null;
}

/** Convert the runner's answers into the payload the API expects, dropping skipped questions. */
export function toSubmission(questions: Question[], answers: Answers) {
  return questions
    .filter((q) => !isBlank(answers[q.id]))
    .map((q) => {
      const value = answers[q.id];
      return {
        question_id: q.id,
        value: q.type === "number" ? Number(value) : typeof value === "string" ? value.trim() : value,
      };
    });
}
