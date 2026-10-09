"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/FormHeader";
import { Menu } from "@/components/ui/Menu";
import { Button, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { FormSummary } from "@/lib/types";
import { formatDate } from "@/lib/useForm";

/** Which dialog is open, and for which form. */
type Dialog = { kind: "create" } | { kind: "rename"; form: FormSummary } | { kind: "delete"; form: FormSummary } | null;

const completion = (form: FormSummary) =>
  form.view_count ? `${Math.min(100, Math.round((form.response_count / form.view_count) * 100))}%` : "—";

/** Workspace dashboard: every form of the creator, with create / rename / duplicate / delete. */
export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");

  const reload = () => api.listForms().then(setForms).catch(() => toast("Couldn't load your forms", "error"));
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Run an action, then refresh the list and confirm with a toast. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setDialog(null);
      await reload();
      toast(success);
    } catch {
      toast("Something went wrong. Please try again.", "error");
    }
  };

  const openDialog = (next: Dialog, initialName = "") => {
    setName(initialName);
    setDialog(next);
  };

  const createForm = async () => {
    try {
      const form = await api.createForm(name.trim() || "My new form");
      router.push(`/forms/${form.id}/create`);
    } catch {
      toast("Couldn't create the form", "error");
    }
  };

  const copyLink = async (form: FormSummary) => {
    await navigator.clipboard.writeText(`${window.location.origin}/to/${form.slug}`);
    toast("Link copied to clipboard");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-medium">Formflow</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Default Creator</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e3c8f0] text-xs font-medium">DC</span>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-line p-3 md:flex">
          <Button className="mb-3 w-full" onClick={() => openDialog({ kind: "create" })}>
            + Create a new form
          </Button>
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">Workspaces</p>
          <div className="flex items-center justify-between rounded-md bg-neutral-100 px-2 py-1.5 text-sm">
            My workspace <span className="text-muted">{forms?.length ?? ""}</span>
          </div>
          <div className="mt-auto rounded-lg border border-dashed border-line p-3 text-xs text-muted">
            <p className="font-medium text-ink">Invite your team</p>
            Collaboration and shared workspaces are coming soon.
          </div>
        </aside>

        <main className="flex-1 bg-canvas p-6 md:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl">My workspace</h1>
              <Button className="md:hidden" onClick={() => openDialog({ kind: "create" })}>
                + New form
              </Button>
            </div>

            {forms === null ? (
              <p className="mt-10 text-center text-muted">Loading…</p>
            ) : forms.length === 0 ? (
              <div className="mt-10 rounded-xl bg-white p-12 text-center ring-1 ring-black/5">
                <p className="text-lg">You don&apos;t have any forms yet</p>
                <Button className="mt-4" onClick={() => openDialog({ kind: "create" })}>
                  Create your first form
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-6 hidden grid-cols-[1fr_110px_110px_110px_170px_40px] gap-2 px-4 text-xs text-muted sm:grid">
                  <span />
                  <span>Status</span>
                  <span>Responses</span>
                  <span>Completion</span>
                  <span>Updated</span>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {forms.map((form) => (
                    <li
                      key={form.id}
                      className="grid grid-cols-[1fr_40px] items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-black/5 hover:shadow-md sm:grid-cols-[1fr_110px_110px_110px_170px_40px]"
                    >
                      <Link href={`/forms/${form.id}/create`} className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#b9d8f5] text-[10px] font-bold text-[#0445AF]">
                          {form.question_count}Q
                        </span>
                        <span className="truncate font-medium">{form.title}</span>
                      </Link>
                      <span className="hidden sm:block">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${form.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-700"}`}>
                          {form.status === "published" ? "Published" : "Draft"}
                        </span>
                      </span>
                      <Link href={`/forms/${form.id}/results`} className="hidden hover:underline sm:block">
                        {form.response_count}
                      </Link>
                      <span className="hidden sm:block">{completion(form)}</span>
                      <span className="hidden text-muted sm:block">{formatDate(form.updated_at)}</span>
                      <Menu
                        label={`Actions for ${form.title}`}
                        trigger={<span className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-neutral-100">⋯</span>}
                        items={[
                          { label: "Open", onSelect: () => router.push(`/forms/${form.id}/create`) },
                          { label: "Results", onSelect: () => router.push(`/forms/${form.id}/results`) },
                          ...(form.status === "published" ? [{ label: "Copy link", onSelect: () => copyLink(form) }] : []),
                          { label: "Rename", onSelect: () => openDialog({ kind: "rename", form }, form.title) },
                          { label: "Duplicate", onSelect: () => run(() => api.duplicateForm(form.id), "Form duplicated") },
                          { label: "Delete", danger: true, onSelect: () => openDialog({ kind: "delete", form }) },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </main>
      </div>

      {(dialog?.kind === "create" || dialog?.kind === "rename") && (
        <Modal title={dialog.kind === "create" ? "Create a new form" : "Rename form"} onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (dialog.kind === "create") void createForm();
              else if (name.trim()) void run(() => api.updateForm(dialog.form.id, { title: name.trim() }), "Form renamed");
            }}
          >
            <label className="text-sm">
              <span className="mb-1.5 block text-muted">Give it a name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My new form"
                maxLength={200}
                className="h-10 w-full rounded-md border border-line px-3 outline-none focus:border-ink"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit">{dialog.kind === "create" ? "Continue" : "Save"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.kind === "delete" && (
        <Modal title="Delete this form?" onClose={() => setDialog(null)}>
          <p className="text-sm text-muted">
            <strong className="text-ink">{dialog.form.title}</strong> and its {dialog.form.response_count} response
            {dialog.form.response_count === 1 ? "" : "s"} will be permanently deleted. This can&apos;t be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => run(() => api.deleteForm(dialog.form.id), "Form deleted")}>
              Yes, delete it
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
