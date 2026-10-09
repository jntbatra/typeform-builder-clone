// Shapes returned by the backend (see backend/app/schemas.py).

export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "dropdown"
  | "email"
  | "number"
  | "yes_no"
  | "rating";

export interface Option {
  // Options created in the builder but not saved yet carry a negative temporary id.
  id: number;
  label: string;
  position: number;
}

export interface Question {
  id: number;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  position: number;
  settings: { max?: number; placeholder?: string };
  options: Option[];
}

export interface Theme {
  primary?: string;
  background?: string;
  text?: string;
}

export type FormStatus = "draft" | "published";

export interface FormSummary {
  id: number;
  title: string;
  slug: string;
  status: FormStatus;
  question_count: number;
  response_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** The part of a form the respondent flow needs; both Form and the public form satisfy it. */
export interface RunnableForm {
  title: string;
  theme: Theme;
  thank_you_title: string;
  thank_you_message: string;
  questions: Question[];
}

export interface Form extends RunnableForm {
  id: number;
  slug: string;
  status: FormStatus;
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/** text for text/email/number, option id for choices, boolean for yes/no, number for rating. */
export type AnswerValue = string | number | boolean | null | undefined;
export type Answers = Record<number, AnswerValue>;

export interface ResponseAnswer {
  question_id: number;
  question_title: string;
  question_type: QuestionType;
  value: string;
}

export interface FormResponse {
  id: number;
  submitted_at: string;
  answers: ResponseAnswer[];
}

export interface QuestionStats {
  question_id: number;
  title: string;
  type: QuestionType;
  answered: number;
  counts: { label: string; count: number }[];
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  samples: string[];
}

export interface FormStats {
  response_count: number;
  view_count: number;
  completion_rate: number | null;
  questions: QuestionStats[];
}
