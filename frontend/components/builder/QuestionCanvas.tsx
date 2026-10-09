"use client";

import { useEffect, useRef } from "react";
import { AnswerInput } from "@/components/respondent/AnswerInput";
import { DEFAULT_THEME } from "@/components/respondent/FormRunner";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { isChoiceType } from "@/lib/questions";
import type { Question } from "@/lib/types";
import { type Builder, type QuestionEdit, tempOptionId } from "@/lib/useBuilder";

// Text fields styled to look like the final text rather than like form inputs.
const INLINE_FIELD = "block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:opacity-40";

interface ChoiceEditorProps {
  question: Question;
  onChange: (patch: QuestionEdit) => void;
}

/** Inline-editable list of choices for multiple choice and dropdown questions. */
function ChoiceEditor({ question, onChange }: ChoiceEditorProps) {
  const { options } = question;
  const setOptions = (next: Question["options"]) => onChange({ options: next });
  const list = useRef<HTMLDivElement>(null);
  // Set when a choice is added, so the new field takes focus once it has rendered.
  const focusNewChoice = useRef(false);

  const addChoice = () => {
    focusNewChoice.current = true;
    setOptions([...options, { id: tempOptionId(), label: "", position: options.length }]);
  };

  useEffect(() => {
    if (!focusNewChoice.current) return;
    focusNewChoice.current = false;
    const inputs = list.current?.querySelectorAll("input");
    inputs?.[inputs.length - 1]?.focus();
  }, [options.length]);

  return (
    <div ref={list} className="flex max-w-sm flex-col gap-2">
      {options.map((option, index) => (
        // Keyed by index, not id: a new option's temporary id is swapped for the real one
        // after saving, and an id key would remount the input and drop focus mid-typing.
        <div key={index} className="tf-choice group">
          <span className="tf-key">{String.fromCharCode(65 + index)}</span>
          <input
            aria-label={`Choice ${index + 1}`}
            value={option.label}
            placeholder={`Choice ${index + 1}`}
            onChange={(event) => setOptions(options.map((o) => (o.id === option.id ? { ...o, label: event.target.value } : o)))}
            onKeyDown={(event) => event.key === "Enter" && addChoice()}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          {options.length > 1 && (
            <button
              aria-label={`Remove choice ${index + 1}`}
              onClick={() => setOptions(options.filter((o) => o.id !== option.id))}
              className="text-sm opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addChoice}
        className="self-start text-sm underline"
        style={{ color: "var(--tf-primary)" }}
      >
        Add choice
      </button>
    </div>
  );
}

/** Centre of the builder: a live, editable rendering of the selected question or ending. */
export function QuestionCanvas({ builder, className = "flex" }: { builder: Builder; className?: string }) {
  const { form, selectedId } = builder;
  if (!form) return null;
  const theme = { ...DEFAULT_THEME, ...form.theme };
  const index = form.questions.findIndex((q) => q.id === selectedId);
  const question = form.questions[index];

  const themeVars = {
    "--tf-primary": theme.primary,
    "--tf-bg": theme.background,
    "--tf-text": theme.text,
    background: theme.background,
    color: theme.text,
  } as React.CSSProperties;

  return (
    <section className={`min-w-0 flex-1 items-center justify-center overflow-auto bg-canvas p-3 md:p-8 ${className}`}>
      <div
        className="flex min-h-[60vh] w-full max-w-4xl items-center justify-center overflow-y-auto rounded-xl px-5 shadow-sm ring-1 ring-line md:aspect-[16/10] md:min-h-0 md:px-20"
        style={themeVars}
      >
        {selectedId === "ending" ? (
          <div className="w-full max-w-xl py-10 text-center">
            <AutoTextarea
              aria-label="Thank you title"
              value={form.thank_you_title}
              placeholder="Say thanks..."
              onChange={(event) => builder.updateForm({ thank_you_title: event.target.value })}
              className={`${INLINE_FIELD} text-center text-4xl`}
            />
            <AutoTextarea
              aria-label="Thank you message"
              value={form.thank_you_message}
              placeholder="Add a message (optional)"
              onChange={(event) => builder.updateForm({ thank_you_message: event.target.value })}
              className={`${INLINE_FIELD} mt-4 text-center text-xl opacity-70`}
            />
          </div>
        ) : question ? (
          // key: remount per question so inputs never show the previous question's text.
          <div key={question.id} className="w-full max-w-[720px] py-10">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 flex shrink-0 items-center gap-1 text-sm" style={{ color: "var(--tf-primary)" }}>
                {index + 1}
                <span aria-hidden>→</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start">
                  <AutoTextarea
                    aria-label="Question title"
                    autoFocus={!question.title}
                    value={question.title}
                    placeholder="Your question here."
                    onChange={(event) => builder.updateQuestion(question.id, { title: event.target.value })}
                    className={`${INLINE_FIELD} text-2xl leading-8`}
                  />
                  {question.required && <span className="text-2xl leading-8">*</span>}
                </div>
                <AutoTextarea
                  aria-label="Question description"
                  value={question.description}
                  placeholder="Description (optional)"
                  onChange={(event) => builder.updateQuestion(question.id, { description: event.target.value })}
                  className={`${INLINE_FIELD} mt-2 text-xl opacity-70`}
                />
                <div className="mt-8">
                  {isChoiceType(question.type) ? (
                    <ChoiceEditor question={question} onChange={(patch) => builder.updateQuestion(question.id, patch)} />
                  ) : (
                    <AnswerInput question={question} value={undefined} onChange={() => {}} onPick={() => {}} readOnly />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-lg opacity-60">Add a question from the left to get started.</p>
        )}
      </div>
    </section>
  );
}
