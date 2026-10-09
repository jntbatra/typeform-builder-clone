// Shapes returned by the backend (see backend/app/schemas.py).

export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "dropdown"
  | "email"
  | "number"
  | "yes_no"
  | "rating"
  | "file_upload";

export type LogicOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than";

/** "If the answer <operator> <value>, go to <target>". */
export interface LogicRule {
  /** Absent on rules added in the builder that have not been saved yet. */
  id?: number;
  operator: LogicOperator;
  /** Text, a number, "yes"/"no", or an option id (as text) for choice questions. */
  value: string;
  /** null = jump to the end of the form. */
  target_question_id: number | null;
}

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
  logic_rules: LogicRule[];
}

export interface Theme {
  primary?: string;
  background?: string;
  text?: string;
  font?: "sans" | "serif" | "mono";
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
  /** The welcome screen is shown only when this is not empty. */
  welcome_title: string;
  welcome_message: string;
  welcome_button: string;
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

/** A file that has been uploaded for a file-upload question. */
export interface FileAnswer {
  upload_id: string;
  filename: string;
}

/** text for text/email/number, option id for choices, boolean for yes/no, number for rating. */
export type AnswerValue = string | number | boolean | FileAnswer | null | undefined;
export type Answers = Record<number, AnswerValue>;

export interface ResponseAnswer {
  question_id: number;
  question_title: string;
  question_type: QuestionType;
  value: string;
  /** Download link, for file-upload answers. */
  file_url: string | null;
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
