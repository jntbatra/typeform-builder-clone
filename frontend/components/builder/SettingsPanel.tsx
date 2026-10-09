"use client";

import { useState } from "react";
import { DEFAULT_THEME } from "@/components/respondent/FormRunner";
import { Toggle } from "@/components/ui/Toggle";
import { QUESTION_TYPE_ORDER, QUESTION_TYPES } from "@/lib/questions";
import type { QuestionType, Theme } from "@/lib/types";
import type { Builder } from "@/lib/useBuilder";

const THEME_PRESETS: { name: string; theme: Required<Theme> }[] = [
  { name: "Default", theme: DEFAULT_THEME },
  { name: "Midnight", theme: { primary: "#F2C94C", background: "#17202E", text: "#FFFFFF" } },
  { name: "Forest", theme: { primary: "#1F6F54", background: "#F3F0E7", text: "#1B2B24" } },
  { name: "Plum", theme: { primary: "#7B2D8E", background: "#FBF4FF", text: "#2A1433" } },
  { name: "Coral", theme: { primary: "#D4472B", background: "#FFF6F1", text: "#33150D" } },
];

const PANEL_TABS = ["Question", "Design", "Logic"] as const;
const RATING_STEPS = [3, 4, 5, 6, 7, 8, 9, 10];

const FIELD = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm outline-none focus:border-ink";

function ComingSoon({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-4 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{children}</p>
      <span className="mt-3 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs">Coming soon</span>
    </div>
  );
}

/** Right sidebar of the builder: per-question settings, theme, and placeholders. */
export function SettingsPanel({ builder, className = "flex" }: { builder: Builder; className?: string }) {
  const [tab, setTab] = useState<(typeof PANEL_TABS)[number]>("Question");
  const { form, selectedId } = builder;
  if (!form) return null;
  const question = form.questions.find((q) => q.id === selectedId);
  const theme = { ...DEFAULT_THEME, ...form.theme };

  return (
    <aside className={`w-full shrink-0 flex-col border-l border-line bg-white md:w-72 ${className}`}>
      <div className="flex gap-5 border-b border-line px-4">
        {PANEL_TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`border-b-2 py-3 text-sm ${tab === name ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "Question" && !question && (
          <p className="text-sm text-muted">
            {selectedId === "ending"
              ? "Edit the thank-you title and message directly on the canvas."
              : "Select a question to edit its settings."}
          </p>
        )}

        {tab === "Question" && question && (
          <div className="flex flex-col gap-4">
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Type</span>
              <select
                value={question.type}
                onChange={(event) => builder.updateQuestion(question.id, { type: event.target.value as QuestionType })}
                className={FIELD}
              >
                {QUESTION_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPES[type].label}
                  </option>
                ))}
              </select>
            </label>

            <div className="border-t border-line pt-2">
              <p className="pt-1 text-sm font-medium">Settings</p>
              <Toggle
                label="Required"
                checked={question.required}
                onChange={(required) => builder.updateQuestion(question.id, { required })}
              />
            </div>

            {question.type === "rating" && (
              <label className="text-sm">
                <span className="mb-1.5 block">Number of stars</span>
                <select
                  value={question.settings.max ?? 5}
                  onChange={(event) =>
                    builder.updateQuestion(question.id, { settings: { ...question.settings, max: Number(event.target.value) } })
                  }
                  className={FIELD}
                >
                  {RATING_STEPS.map((steps) => (
                    <option key={steps}>{steps}</option>
                  ))}
                </select>
              </label>
            )}

            {QUESTION_TYPES[question.type].placeholder && (
              <label className="text-sm">
                <span className="mb-1.5 block">Placeholder</span>
                <input
                  value={question.settings.placeholder ?? ""}
                  placeholder={QUESTION_TYPES[question.type].placeholder}
                  onChange={(event) =>
                    builder.updateQuestion(question.id, { settings: { ...question.settings, placeholder: event.target.value } })
                  }
                  className={FIELD}
                />
              </label>
            )}

            <p className="text-xs text-muted">Edit the question text, description and choices directly on the canvas.</p>
          </div>
        )}

        {tab === "Design" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">Theme</p>
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((preset) => {
                const active = preset.theme.primary === theme.primary && preset.theme.background === theme.background;
                return (
                  <button
                    key={preset.name}
                    onClick={() => builder.updateForm({ theme: preset.theme })}
                    className={`rounded-lg border p-2 text-left text-xs ${active ? "border-ink ring-1 ring-ink" : "border-line hover:border-neutral-400"}`}
                  >
                    <span
                      className="mb-1.5 flex h-12 flex-col justify-center gap-1 rounded px-2"
                      style={{ background: preset.theme.background }}
                    >
                      <span className="h-1.5 w-10 rounded" style={{ background: preset.theme.text }} />
                      <span className="h-1.5 w-6 rounded" style={{ background: preset.theme.primary }} />
                    </span>
                    {preset.name}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
              <p className="font-medium">Custom colours</p>
              {(["primary", "background", "text"] as const).map((key) => (
                <label key={key} className="flex items-center justify-between capitalize">
                  {key === "primary" ? "Answers and buttons" : key === "text" ? "Questions" : "Background"}
                  <input
                    type="color"
                    value={theme[key]}
                    onChange={(event) => builder.updateForm({ theme: { ...theme, [key]: event.target.value } })}
                    className="h-7 w-10 cursor-pointer rounded border border-line bg-white"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "Logic" && (
          <div className="flex flex-col gap-3">
            <ComingSoon title="Branching and logic jumps">
              Send respondents to different questions based on their answers.
            </ComingSoon>
            <ComingSoon title="Scoring and calculations">Add up points as people answer.</ComingSoon>
          </div>
        )}
      </div>
    </aside>
  );
}
