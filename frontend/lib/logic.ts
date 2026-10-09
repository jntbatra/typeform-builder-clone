// Logic jumps: which question comes next, given the answers so far.
// The server repeats this on submit (backend/app/logic.py); keep the two in step.

import type { Answers, AnswerValue, LogicOperator, LogicRule, Question, QuestionType } from "./types";

const isNumeric = (type: QuestionType) => type === "number" || type === "rating";

/** Operators that make sense for each kind of answer. File uploads have none, so no logic. */
export function operatorsFor(type: QuestionType): LogicOperator[] {
  if (type === "file_upload") return [];
  if (isNumeric(type)) return ["equals", "not_equals", "greater_than", "less_than"];
  if (type === "multiple_choice" || type === "dropdown" || type === "yes_no") return ["equals", "not_equals"];
  return ["equals", "not_equals", "contains"];
}

export const OPERATOR_LABELS: Record<LogicOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  greater_than: "is greater than",
  less_than: "is less than",
};

/** The answer in the form rules are written in: a number, "yes"/"no", or lower-case text. */
function comparable(question: Question, value: AnswerValue): string | number | null {
  if (value === null || value === undefined || typeof value === "object") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (question.type === "yes_no") return value === true ? "yes" : "no";
  if (isNumeric(question.type)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  // For choice questions the value is the option id, so this is that id as text.
  return String(value).trim().toLowerCase();
}

function ruleMatches(rule: LogicRule, question: Question, value: AnswerValue): boolean {
  const answer = comparable(question, value);
  if (answer === null) return false;

  if (typeof answer === "number") {
    const expected = Number(rule.value);
    if (rule.value.trim() === "" || !Number.isFinite(expected)) return false;
    if (rule.operator === "equals") return answer === expected;
    if (rule.operator === "not_equals") return answer !== expected;
    if (rule.operator === "greater_than") return answer > expected;
    if (rule.operator === "less_than") return answer < expected;
    return false;
  }

  const expected = rule.value.trim().toLowerCase();
  if (rule.operator === "equals") return answer === expected;
  if (rule.operator === "not_equals") return answer !== expected;
  if (rule.operator === "contains") return answer.includes(expected);
  return false;
}

/** Index of the question that follows `index`, or null when the form ends there. */
export function nextIndex(questions: Question[], index: number, answers: Answers): number | null {
  const question = questions[index];
  for (const rule of question.logic_rules) {
    if (!ruleMatches(rule, question, answers[question.id])) continue;
    if (rule.target_question_id === null) return null; // jump to the end
    const target = questions.findIndex((q) => q.id === rule.target_question_id);
    // Only forward jumps are followed, so a form can never loop.
    if (target > index) return target;
  }
  return index + 1 < questions.length ? index + 1 : null;
}

/** Indices of every question the respondent is shown, in order, for these answers. */
export function visitedIndices(questions: Question[], answers: Answers): number[] {
  const visited: number[] = [];
  let index: number | null = questions.length ? 0 : null;
  while (index !== null) {
    visited.push(index);
    index = nextIndex(questions, index, answers);
  }
  return visited;
}
