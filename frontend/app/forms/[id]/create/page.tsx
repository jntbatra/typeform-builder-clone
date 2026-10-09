"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { QuestionCanvas } from "@/components/builder/QuestionCanvas";
import { QuestionList } from "@/components/builder/QuestionList";
import { SettingsPanel } from "@/components/builder/SettingsPanel";
import { FormHeader } from "@/components/FormHeader";
import { FormRunner } from "@/components/respondent/FormRunner";
import { Button } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Loading } from "@/components/ui/Loading";
import { useBuilder } from "@/lib/useBuilder";

const PANELS = ["Questions", "Edit", "Settings"] as const;
type Panel = (typeof PANELS)[number];

/** The form builder: question list, live editable canvas, settings. */
export default function CreatePage() {
  const formId = Number(useParams<{ id: string }>().id);
  const toast = useToast();
  const onError = useCallback((message: string) => toast(message, "error"), [toast]);
  const builder = useBuilder(formId, onError);
  const [previewing, setPreviewing] = useState(false);
  // Phones show one of the three panels at a time; wider screens show all of them.
  const [panel, setPanel] = useState<Panel>("Edit");
  const { form } = builder;

  if (builder.notFound) return <div className="flex min-h-screen items-center justify-center text-muted">Form not found.</div>;
  if (!form) return <Loading />;

  const published = form.status === "published";
  const shareUrl = `${window.location.origin}/to/${form.slug}`;

  const show = (name: Panel) => `${panel === name ? "flex" : "hidden"} md:flex`;

  const togglePublish = async () => {
    if (!published && form.questions.length === 0) return toast("Add at least one question before publishing", "error");
    if (!(await builder.setPublished(!published))) return;
    if (published) return toast("Form unpublished. The link no longer works.");
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    toast("Form published. Link copied to clipboard.");
  };

  return (
    <div className="flex h-screen flex-col">
      <FormHeader formId={form.id} title={form.title} active="create" onRename={(title) => builder.updateForm({ title })}>
        <span className="mr-1 hidden text-xs text-muted sm:inline" aria-live="polite">
          {builder.saving ? "Saving…" : "Saved"}
        </span>
        <Button variant="secondary" onClick={() => setPreviewing(true)}>
          ▶ Preview
        </Button>
        <Button onClick={togglePublish}>{published ? "Unpublish" : "Publish"}</Button>
      </FormHeader>

      <div className="flex gap-1 border-b border-line bg-surface p-1.5 md:hidden">
        {PANELS.map((name) => (
          <button
            key={name}
            onClick={() => setPanel(name)}
            className={`h-8 flex-1 rounded-md text-sm ${panel === name ? "bg-subtle-strong font-medium" : "text-muted"}`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* On a phone, picking or adding a question jumps straight to editing it. */}
        <QuestionList builder={builder} className={show("Questions")} onNavigate={() => setPanel("Edit")} />
        <QuestionCanvas builder={builder} className={show("Edit")} />
        <SettingsPanel builder={builder} className={show("Settings")} />
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 text-sm">
            <span>
              <strong>Preview</strong> <span className="text-muted">· answers here are not saved</span>
            </span>
            <Button variant="secondary" onClick={() => setPreviewing(false)}>
              Close preview
            </Button>
          </div>
          <div className="relative flex-1">
            {/* The same component respondents get, fed the unsaved builder state. */}
            <FormRunner
              form={form}
              embedded
              onSubmit={async () => {}}
              // Nothing is sent in preview: pretend the upload worked so the flow can be tried.
              onUpload={async (_questionId, file) => ({ upload_id: "preview", filename: file.name })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
