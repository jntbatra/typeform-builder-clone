"use client";

import { useEffect, useState } from "react";
import { FormHeader } from "@/components/FormHeader";
import { ResponsesTable } from "@/components/results/ResponsesTable";
import { Summary } from "@/components/results/Summary";
import { Button } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { FormResponse, FormStats } from "@/lib/types";
import { useForm } from "@/lib/useForm";

const VIEWS = ["Summary", "Responses"] as const;

/** Results for one form: aggregate summary and the individual submissions. */
export default function ResultsPage() {
  const { formId, form, notFound } = useForm();
  const toast = useToast();
  const [view, setView] = useState<(typeof VIEWS)[number]>("Summary");
  const [stats, setStats] = useState<FormStats | null>(null);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);

  useEffect(() => {
    Promise.all([api.getStats(formId), api.listResponses(formId)])
      .then(([loadedStats, loadedResponses]) => {
        setStats(loadedStats);
        setResponses(loadedResponses);
      })
      .catch(() => {});
  }, [formId]);

  if (notFound) return <div className="flex min-h-screen items-center justify-center text-muted">Form not found.</div>;
  if (!form || !stats || !responses) return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;

  const deleteResponse = async (id: number) => {
    try {
      await api.deleteResponse(id);
      setResponses(responses.filter((r) => r.id !== id));
      setStats(await api.getStats(formId)); // counts changed, so refresh the summary
      toast("Response deleted");
    } catch {
      toast("Couldn't delete the response", "error");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <FormHeader formId={form.id} title={form.title} active="results" />
      <main className="mx-auto w-full max-w-5xl flex-1 p-8">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-neutral-200/70 p-1">
            {VIEWS.map((name) => (
              <button
                key={name}
                onClick={() => setView(name)}
                className={`rounded-md px-3 py-1 text-sm ${view === name ? "bg-white shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {name}
                {name === "Responses" && ` [${responses.length}]`}
              </button>
            ))}
          </div>
          <a href={api.exportUrl(form.id)} download>
            <Button variant="secondary" disabled={responses.length === 0}>
              ↓ Export CSV
            </Button>
          </a>
        </div>

        {view === "Summary" ? (
          <Summary stats={stats} />
        ) : (
          <ResponsesTable questions={form.questions} responses={responses} onDelete={deleteResponse} />
        )}
      </main>
    </div>
  );
}
