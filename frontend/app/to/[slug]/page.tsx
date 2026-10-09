"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormRunner } from "@/components/respondent/FormRunner";
import { Loading } from "@/components/ui/Loading";
import { api } from "@/lib/api";
import { toSubmission } from "@/lib/questions";
import type { RunnableForm } from "@/lib/types";

/** Public, shareable form page. No login: anyone with the link can respond. */
export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<RunnableForm | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api
      .getPublicForm(slug)
      .then((loaded) => {
        setForm(loaded);
        document.title = loaded.title;
        // Counted once per page load; compared with responses for the completion rate.
        api.recordView(slug).catch(() => {});
      })
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-3xl">This form isn&apos;t available</h1>
        <p className="text-muted">It may have been unpublished or the link may be wrong.</p>
      </div>
    );
  }
  if (!form) return <Loading />;

  return (
    <FormRunner
      form={form}
      onSubmit={async (answers) => {
        await api.submitResponse(slug, toSubmission(form.questions, answers));
      }}
      onUpload={(questionId, file) => api.uploadFile(slug, questionId, file)}
    />
  );
}
