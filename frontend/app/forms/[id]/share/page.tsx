"use client";

import { FormHeader } from "@/components/FormHeader";
import { Button } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Loading } from "@/components/ui/Loading";
import { api } from "@/lib/api";
import { useForm } from "@/lib/useForm";

const COMING_SOON = [
  { title: "Embed in a web page", text: "Drop your form into any site as a popup, slider or inline widget." },
  { title: "Share with your team", text: "Invite collaborators to edit this form and see its results." },
  { title: "QR code", text: "Download a QR code that opens this form." },
];

/** Publish state and the shareable public link. */
export default function SharePage() {
  const { form, setForm, notFound } = useForm();
  const toast = useToast();

  if (notFound) return <div className="flex min-h-screen items-center justify-center text-muted">Form not found.</div>;
  if (!form) return <Loading />;

  const published = form.status === "published";
  const shareUrl = `${window.location.origin}/to/${form.slug}`;

  const setPublished = async (publish: boolean) => {
    try {
      setForm(await (publish ? api.publishForm(form.id) : api.unpublishForm(form.id)));
      toast(publish ? "Form published" : "Form unpublished");
    } catch {
      toast("Couldn't update the form", "error");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast("Link copied to clipboard");
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <FormHeader formId={form.id} title={form.title} active="share" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-8">
        <h1 className="text-2xl">Share your form</h1>

        <section className="mt-6 rounded-xl bg-surface p-6 ring-1 ring-line">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Share the link</h2>
              <p className="mt-0.5 text-sm text-muted">
                {published ? "Anyone with this link can respond. No login needed." : "Publish the form to activate its link."}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${published ? "bg-emerald-100 text-emerald-800" : "bg-subtle-strong text-ink"}`}>
              {published ? "Published" : "Draft"}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <input readOnly aria-label="Public link" value={shareUrl} disabled={!published} className="h-9 min-w-0 flex-1 rounded-md border border-line bg-subtle px-3 text-sm disabled:text-muted" />
            {published ? (
              <>
                <Button onClick={copy}>Copy link</Button>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary">Open ↗</Button>
                </a>
              </>
            ) : (
              <Button onClick={() => setPublished(true)}>Publish</Button>
            )}
          </div>
          {published && (
            <button onClick={() => setPublished(false)} className="mt-3 text-sm text-muted underline hover:text-ink">
              Unpublish this form
            </button>
          )}
        </section>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {COMING_SOON.map((item) => (
            <section key={item.title} className="rounded-xl bg-surface p-5 ring-1 ring-line">
              <h2 className="text-sm font-medium">{item.title}</h2>
              <p className="mt-1 text-sm text-muted">{item.text}</p>
              <span className="mt-3 inline-block rounded-full bg-subtle px-2.5 py-0.5 text-xs">Coming soon</span>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
