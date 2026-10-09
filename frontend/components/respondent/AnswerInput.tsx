"use client";

import { useRef, useState } from "react";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { QUESTION_TYPES } from "@/lib/questions";
import type { AnswerValue, FileAnswer, Question } from "@/lib/types";

interface AnswerInputProps {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  /** Called when the answer is a single pick (choice, yes/no, rating), so the form can move on. */
  onPick: (value: AnswerValue) => void;
  /** Send a picked file to the server. Only needed where file-upload questions can be answered. */
  onUpload?: (file: File) => Promise<FileAnswer>;
  /** Builder canvas: show the control but do not let it take focus or input. */
  readOnly?: boolean;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const letter = (index: number) => String.fromCharCode(65 + index);

/** The answer control for one question, switched on its type. */
export function AnswerInput({ question, value, onChange, onPick, onUpload, readOnly = false }: AnswerInputProps) {
  const meta = QUESTION_TYPES[question.type];
  const placeholder = question.settings.placeholder || meta.placeholder;
  const common = { readOnly, tabIndex: readOnly ? -1 : 0, autoFocus: !readOnly, placeholder };
  const text = typeof value === "string" ? value : "";

  switch (question.type) {
    case "short_text":
    case "email":
    case "number":
      return (
        <input
          {...common}
          className="tf-input"
          type={question.type === "email" ? "email" : "text"}
          inputMode={question.type === "number" ? "decimal" : undefined}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "long_text":
      return (
        <div>
          <AutoTextarea
            {...common}
            className="tf-input max-h-64"
            value={text}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="mt-2 text-xs" style={{ color: "var(--tf-primary)" }}>
            <strong>Shift ⇧ + Enter ↵</strong> to make a line break
          </p>
        </div>
      );

    case "multiple_choice":
      return (
        <div className="flex max-w-sm flex-col gap-2">
          {question.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              tabIndex={readOnly ? -1 : 0}
              className="tf-choice"
              data-selected={value === option.id}
              onClick={() => !readOnly && onPick(option.id)}
            >
              <span className="tf-key">{letter(index)}</span>
              <span className="flex-1">{option.label}</span>
              {value === option.id && <span>✓</span>}
            </button>
          ))}
        </div>
      );

    case "yes_no":
      return (
        <div className="flex max-w-[200px] flex-col gap-2">
          {[true, false].map((choice) => (
            <button
              key={String(choice)}
              type="button"
              tabIndex={readOnly ? -1 : 0}
              className="tf-choice"
              data-selected={value === choice}
              onClick={() => !readOnly && onPick(choice)}
            >
              <span className="tf-key">{choice ? "Y" : "N"}</span>
              <span className="flex-1">{choice ? "Yes" : "No"}</span>
              {value === choice && <span>✓</span>}
            </button>
          ))}
        </div>
      );

    case "rating": {
      const max = question.settings.max ?? 5;
      const current = typeof value === "number" ? value : 0;
      return (
        <div className="flex gap-3">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={`${star} out of ${max}`}
              onClick={() => !readOnly && onPick(star)}
              className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
              style={{ color: "var(--tf-primary)" }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor"
                fill={star <= current ? "currentColor" : "color-mix(in srgb, currentColor 10%, transparent)"}>
                <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" strokeLinejoin="round" />
              </svg>
              <span className="text-sm">{star}</span>
            </button>
          ))}
        </div>
      );
    }

    case "dropdown":
      return <Dropdown question={question} value={value} onPick={onPick} readOnly={readOnly} placeholder={placeholder} />;

    case "file_upload":
      return <FileUpload value={value} onChange={onChange} onUpload={onUpload} readOnly={readOnly} />;
  }
}

type FileUploadProps = Pick<AnswerInputProps, "value" | "onChange" | "onUpload" | "readOnly">;

/** Click-or-drop zone. The file is uploaded as soon as it is picked; the answer is its upload id. */
function FileUpload({ value, onChange, onUpload, readOnly }: FileUploadProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = typeof value === "object" && value !== null ? value : null;

  const send = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError("Files can be up to 5 MB");
    setBusy(true);
    setError(null);
    try {
      onChange(await onUpload(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <button
        type="button"
        tabIndex={readOnly ? -1 : 0}
        disabled={busy}
        onClick={() => !readOnly && picker.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!readOnly) void send(event.dataTransfer.files[0]);
        }}
        className="flex min-h-36 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center"
        style={{
          color: "var(--tf-primary)",
          borderColor: "color-mix(in srgb, var(--tf-primary) 60%, transparent)",
          background: "color-mix(in srgb, var(--tf-primary) 8%, transparent)",
        }}
      >
        {busy ? (
          <span>Uploading…</span>
        ) : uploaded ? (
          <>
            <span className="text-lg">✓ {uploaded.filename}</span>
            <span className="text-xs underline">Choose a different file</span>
          </>
        ) : (
          <>
            <span className="text-2xl" aria-hidden>
              ⇪
            </span>
            <span>
              <strong>Choose file</strong> or <strong>drag here</strong>
            </span>
            <span className="text-xs">Size limit: 5 MB</span>
          </>
        )}
      </button>
      <input ref={picker} type="file" hidden onChange={(event) => send(event.target.files?.[0])} />
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#af0404]">
          {error}
        </p>
      )}
    </div>
  );
}

interface DropdownProps extends Pick<AnswerInputProps, "question" | "value" | "onPick" | "readOnly"> {
  placeholder: string;
}

/** Typeform-style dropdown: a text field that filters a list of options as you type. */
function Dropdown({ question, value, onPick, readOnly, placeholder }: DropdownProps) {
  const selected = question.options.find((option) => option.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = question.options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative max-w-xl">
      <input
        className="tf-input pr-8"
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : 0}
        autoFocus={!readOnly}
        placeholder={placeholder}
        // Show the picked label until the respondent starts typing a new search.
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => !readOnly && setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      <span className="pointer-events-none absolute right-1 top-1 text-xl" style={{ color: "var(--tf-primary)" }}>
        ⌄
      </span>
      {open && !readOnly && (
        <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto pb-1">
          {matches.length === 0 && (
            <p className="text-sm" style={{ color: "var(--tf-primary)" }}>No suggestions found</p>
          )}
          {matches.map((option) => (
            <button
              key={option.id}
              type="button"
              className="tf-choice"
              data-selected={value === option.id}
              onClick={() => {
                setOpen(false);
                setQuery("");
                onPick(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
