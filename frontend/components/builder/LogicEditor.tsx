"use client";

import { OPERATOR_LABELS, operatorsFor } from "@/lib/logic";
import { isChoiceType } from "@/lib/questions";
import type { LogicRule, Question } from "@/lib/types";

const FIELD = "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-sm outline-none focus:border-ink";

/** What a jump can lead to: a later question, or the end of the form (stored as null). */
const END = "end";

interface LogicEditorProps {
  question: Question;
  /** Every question of the form, in order. */
  questions: Question[];
  onChange: (rules: LogicRule[]) => void;
}

interface ValueFieldProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

/** The right control for "compare the answer with...", depending on the question type. */
function ValueField({ question, value, onChange }: ValueFieldProps) {
  if (isChoiceType(question.type)) {
    // Only saved options have a real id to compare against.
    const saved = question.options.filter((option) => option.id > 0);
    return (
      <select aria-label="Value" value={value} onChange={(event) => onChange(event.target.value)} className={FIELD}>
        {saved.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (question.type === "yes_no") {
    return (
      <select aria-label="Value" value={value} onChange={(event) => onChange(event.target.value)} className={FIELD}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  const numeric = question.type === "number" || question.type === "rating";
  return (
    <input
      aria-label="Value"
      type={numeric ? "number" : "text"}
      value={value}
      placeholder={numeric ? "0" : "some text"}
      onChange={(event) => onChange(event.target.value)}
      className={FIELD}
    />
  );
}

function defaultValue(question: Question): string {
  if (isChoiceType(question.type)) return String(question.options.find((option) => option.id > 0)?.id ?? "");
  if (question.type === "yes_no") return "yes";
  return "";
}

/** Logic jumps of one question: "if the answer is X, go to question Y". */
export function LogicEditor({ question, questions, onChange }: LogicEditorProps) {
  const operators = operatorsFor(question.type);
  const index = questions.findIndex((q) => q.id === question.id);
  // Jumps only go forward, which also makes loops impossible.
  const laterQuestions = questions.slice(index + 1);
  const rules = question.logic_rules;

  if (operators.length === 0) {
    return <p className="text-sm text-muted">Logic jumps aren&apos;t available for file upload questions.</p>;
  }

  const update = (ruleIndex: number, patch: Partial<LogicRule>) =>
    onChange(rules.map((rule, i) => (i === ruleIndex ? { ...rule, ...patch } : rule)));

  const addRule = () =>
    onChange([
      ...rules,
      { operator: operators[0], value: defaultValue(question), target_question_id: laterQuestions[1]?.id ?? null },
    ]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Logic jumps</p>
        <p className="mt-0.5 text-xs text-muted">Send people to a different question depending on their answer here.</p>
      </div>

      {rules.map((rule, ruleIndex) => (
        <div key={ruleIndex} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">If the answer</span>
            <button aria-label={`Remove rule ${ruleIndex + 1}`} onClick={() => onChange(rules.filter((_, i) => i !== ruleIndex))} className="rounded px-1 text-muted hover:bg-subtle hover:text-ink">
              ✕
            </button>
          </div>
          <select
            aria-label="Condition"
            value={rule.operator}
            onChange={(event) => update(ruleIndex, { operator: event.target.value as LogicRule["operator"] })}
            className={FIELD}
          >
            {operators.map((operator) => (
              <option key={operator} value={operator}>
                {OPERATOR_LABELS[operator]}
              </option>
            ))}
          </select>
          <ValueField question={question} value={rule.value} onChange={(value) => update(ruleIndex, { value })} />
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Then go to</span>
          <select
            aria-label="Go to"
            value={rule.target_question_id ?? END}
            onChange={(event) =>
              update(ruleIndex, { target_question_id: event.target.value === END ? null : Number(event.target.value) })
            }
            className={FIELD}
          >
            {laterQuestions.map((later, offset) => (
              <option key={later.id} value={later.id}>
                {index + offset + 2}. {later.title || "Untitled question"}
              </option>
            ))}
            <option value={END}>End of the form</option>
          </select>
        </div>
      ))}

      <button onClick={addRule} className="h-8 rounded-md bg-subtle text-sm font-medium hover:bg-subtle-strong">
        + Add rule
      </button>
      <p className="text-xs text-muted">
        Rules are checked top to bottom and the first match wins. If none match, the form continues to the next
        question.
      </p>
    </div>
  );
}
