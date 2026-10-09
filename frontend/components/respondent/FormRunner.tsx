"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { themeStyle } from "@/lib/formTheme";
import { nextIndex, visitedIndices } from "@/lib/logic";
import { validateAnswer } from "@/lib/questions";
import type { Answers, AnswerValue, FileAnswer, RunnableForm } from "@/lib/types";
import { AnswerInput } from "./AnswerInput";

interface FormRunnerProps {
  form: RunnableForm;
  /** Persist the answers. Throw an ApiError carrying per-question errors to send the respondent back. */
  onSubmit: (answers: Answers) => Promise<void>;
  /** Send the file picked for a file-upload question and return what to keep as the answer. */
  onUpload: (questionId: number, file: File) => Promise<FileAnswer>;
  /** Fill the parent element instead of the whole window (builder preview). */
  embedded?: boolean;
}

/** Pause after a single-pick answer so the respondent sees their choice register before moving on. */
const AUTO_ADVANCE_MS = 450;

// direction is 1 when moving forward (new question rises from below) and -1 when going back.
const slide = {
  enter: (direction: number) => ({ y: direction * 90, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({ y: direction * -90, opacity: 0 }),
};

/** The one-question-at-a-time respondent experience. */
export function FormRunner({ form, onSubmit, onUpload, embedded = false }: FormRunnerProps) {
  const { questions } = form;

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // The welcome screen is optional: it exists only when the creator gave it a title.
  const [started, setStarted] = useState(false);
  const showWelcome = form.welcome_title.trim() !== "" && !started;
  // A ref, not state: it must block a second submit triggered before the next render.
  const submitting = useRef(false);
  // Timer for the pause before auto-advancing after a pick; cancelled by any other navigation.
  const autoAdvance = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(autoAdvance.current), []);

  const question = questions[index];
  // Logic jumps decide what comes next, so "next" and "previous" are read off the
  // respondent's path through the form rather than index + 1 and index - 1.
  const following = question ? nextIndex(questions, index, answers) : null;
  const isLast = following === null;
  const path = visitedIndices(questions, answers);
  const previous = path[path.indexOf(index) - 1];
  const progress = done ? 100 : questions.length ? (index / questions.length) * 100 : 0;

  const goTo = (target: number, message: string | null = null) => {
    clearTimeout(autoAdvance.current);
    setDirection(target >= index ? 1 : -1);
    setIndex(target);
    setError(message);
  };

  const submit = async (current: Answers) => {
    // Re-check every question on the path, in case an earlier answer was cleared since.
    const firstInvalid = visitedIndices(questions, current).find((i) => validateAnswer(questions[i], current[questions[i].id]));
    if (firstInvalid !== undefined) {
      return goTo(firstInvalid, validateAnswer(questions[firstInvalid], current[questions[firstInvalid].id]));
    }
    if (submitting.current) return;
    submitting.current = true;
    try {
      await onSubmit(current);
      setDirection(1);
      setDone(true);
    } catch (caught) {
      // Server-side validation failed: jump to the first question it rejected.
      const errors = caught instanceof ApiError ? caught.errors : {};
      const rejected = questions.findIndex((q) => errors[q.id]);
      if (rejected !== -1) goTo(rejected, errors[questions[rejected].id]);
      else setError("We couldn't submit your answers. Please try again.");
    } finally {
      submitting.current = false;
    }
  };

  /** OK button / Enter: validate the current answer, then move on or submit. */
  const advance = (current: Answers = answers) => {
    if (!question || done) return;
    const problem = validateAnswer(question, current[question.id]);
    if (problem) return setError(problem);
    // Recomputed here because `current` may be newer than the answers of this render.
    const next = nextIndex(questions, index, current);
    if (next === null) void submit(current);
    else goTo(next);
  };

  const goBack = () => previous !== undefined && !done && goTo(previous);
  const goForward = () => !isLast && advance();

  const setAnswer = (value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [question.id]: value }));
    setError(null);
  };

  /** Single-pick answers (choice, yes/no, rating) advance on their own, like Typeform. */
  const pick = (value: AnswerValue) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    setError(null);
    clearTimeout(autoAdvance.current);
    autoAdvance.current = setTimeout(() => advance(next), AUTO_ADVANCE_MS);
  };

  // Keyboard: Enter to continue, arrows to move, and shortcut keys for single-pick answers.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showWelcome) {
        if (event.key === "Enter") setStarted(true);
        return;
      }
      if (!question || done) return;
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (event.key === "Enter") {
        // Shift+Enter is a line break in long text; a focused button handles its own Enter.
        if (event.shiftKey || target.tagName === "BUTTON") return;
        event.preventDefault();
        return advance();
      }
      if (target.tagName === "TEXTAREA") return;
      if (event.key === "ArrowDown") return goForward();
      if (event.key === "ArrowUp") return goBack();
      if (typing) return;

      const key = event.key.toLowerCase();
      if (question.type === "multiple_choice" && /^[a-z]$/.test(key)) {
        const option = question.options[key.charCodeAt(0) - 97];
        if (option) pick(option.id);
      } else if (question.type === "yes_no" && (key === "y" || key === "n")) {
        pick(key === "y");
      } else if (question.type === "rating" && /^[1-9]$/.test(key) && Number(key) <= (question.settings.max ?? 5)) {
        pick(Number(key));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }); // no dependency list: the handler must always see the latest answers and index

  const restart = () => {
    setAnswers({});
    setDone(false);
    setStarted(false);
    goTo(0);
  };


  return (
    <div className={`${embedded ? "absolute" : "fixed"} inset-0 flex flex-col overflow-hidden`} style={themeStyle(form.theme)}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-full"
        style={{ background: "color-mix(in srgb, var(--tf-primary) 20%, transparent)" }}
      >
        <motion.div className="h-full" style={{ background: "var(--tf-primary)" }} animate={{ width: `${progress}%` }} />
      </div>

      <main className="relative flex-1">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={showWelcome ? "welcome" : done ? "thank-you" : (question?.id ?? "empty")}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 flex items-center justify-center overflow-y-auto px-6 md:px-20"
          >
            {showWelcome ? (
              <div className="max-w-xl py-10 text-center">
                <h1 className="text-4xl">{form.welcome_title}</h1>
                {form.welcome_message && <p className="mt-4 text-xl opacity-70">{form.welcome_message}</p>}
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    autoFocus
                    onClick={() => setStarted(true)}
                    className="rounded px-3.5 py-1.5 text-xl font-bold transition-opacity hover:opacity-80"
                    style={{ background: "var(--tf-primary)", color: "var(--tf-bg)" }}
                  >
                    {form.welcome_button || "Start"}
                  </button>
                  <span className="text-xs">
                    press <strong>Enter ↵</strong>
                  </span>
                </div>
              </div>
            ) : done ? (
              <div className="max-w-xl py-10 text-center">
                <h1 className="text-4xl">{form.thank_you_title}</h1>
                <p className="mt-4 text-xl opacity-70">{form.thank_you_message}</p>
                <button onClick={restart} className="mt-8 text-sm underline" style={{ color: "var(--tf-primary)" }}>
                  Submit another response
                </button>
              </div>
            ) : !question ? (
              <p className="text-xl opacity-70">This form has no questions yet.</p>
            ) : (
              <div className="w-full max-w-[720px] py-10">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 flex shrink-0 items-center gap-1 text-sm" style={{ color: "var(--tf-primary)" }}>
                    {index + 1}
                    <span aria-hidden>→</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl leading-8">
                      {question.title || "…"}
                      {question.required && <span aria-label="required"> *</span>}
                    </h1>
                    {question.description && <p className="mt-2 text-xl opacity-70">{question.description}</p>}

                    <div className="mt-8">
                      <AnswerInput
                        question={question}
                        value={answers[question.id]}
                        onChange={setAnswer}
                        onPick={pick}
                        onUpload={(file) => onUpload(question.id, file)}
                      />
                    </div>

                    {error ? (
                      <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded bg-[#f7e6e6] px-3 py-1 text-sm text-[#af0404]">
                        <span aria-hidden>⚠</span> {error}
                      </div>
                    ) : (
                      <div className="mt-5 flex items-center gap-3">
                        <button
                          onClick={() => advance()}
                          className="rounded px-3.5 py-1.5 text-xl font-bold transition-opacity hover:opacity-80"
                          style={{ background: "var(--tf-primary)", color: "var(--tf-bg)" }}
                        >
                          {isLast ? "Submit" : "OK ✓"}
                        </button>
                        <span className="text-xs">
                          press <strong>Enter ↵</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="flex items-center justify-end gap-2 p-4">
        <div className="flex overflow-hidden rounded" style={{ background: "var(--tf-primary)", color: "var(--tf-bg)" }}>
          <button aria-label="Previous question" disabled={previous === undefined || done || showWelcome} onClick={goBack} className="px-2.5 py-1.5 disabled:opacity-40">
            ▲
          </button>
          <span className="w-px bg-white/30" />
          <button aria-label="Next question" disabled={isLast || done || !question || showWelcome} onClick={goForward} className="px-2.5 py-1.5 disabled:opacity-40">
            ▼
          </button>
        </div>
        <span className="rounded px-3 py-1.5 text-sm" style={{ background: "var(--tf-primary)", color: "var(--tf-bg)" }}>
          Powered by <strong>Formflow</strong>
        </span>
      </footer>
    </div>
  );
}
