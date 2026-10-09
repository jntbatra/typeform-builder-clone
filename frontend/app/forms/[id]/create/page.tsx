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
import { useBuilder } from "@/lib/useBuilder";

/** The form builder: question list, live editable canvas, settings. */
export default function CreatePage() {
  const formId = Number(useParams<{ id: string }>().id);
  const toast = useToast();
  const onError = useCallback((message: string) => toast(message, "error"), [toast]);
  const builder = useBuilder(formId, onError);
  const [previewing, setPreviewing] = useState(false);
  const { form } = builder;

  if (builder.notFound) return <div className="flex min-h-screen items-center justify-center text-muted">Form not found.</div>;
  if (!form) return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;

  const published = form.status === "published";
  const shareUrl = `${window.location.origin}/to/${form.slug}`;

  const togglePublish = async () => {
    if (!(await builder.setPublished(!published))) return;
    if (published) return toast("Form unpublished. The link no longer works.");
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    toast("Form published. Link copied to clipboard.");
  };

  return (
    <div className="flex h-screen flex-col">
      <FormHeader formId={form.id} title={form.title} active="create" onRename={(title) => builder.updateForm({ title })}>
        <span className="mr-1 text-xs text-muted" aria-live="polite">
          {builder.saving ? "Saving…" : "Saved"}
        </span>
        <Button variant="secondary" onClick={() => setPreviewing(true)}>
          ▶ Preview
        </Button>
        <Button onClick={togglePublish}>{published ? "Unpublish" : "Publish"}</Button>
      </FormHeader>

      <div className="flex min-h-0 flex-1">
        <QuestionList builder={builder} />
        <QuestionCanvas builder={builder} />
        <SettingsPanel builder={builder} />
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
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
            <FormRunner form={form} embedded onSubmit={async () => {}} />
          </div>
        </div>
      )}
    </div>
  );
}
