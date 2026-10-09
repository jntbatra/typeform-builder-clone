"use client";

import { FormHeader } from "@/components/FormHeader";
import { useForm } from "@/lib/useForm";

const INTEGRATIONS = [
  { name: "Google Sheets", text: "Send every response to a spreadsheet." },
  { name: "Slack", text: "Get a message in a channel for each new response." },
  { name: "Webhooks", text: "POST responses to your own endpoint in real time." },
  { name: "Zapier", text: "Connect to thousands of other apps." },
  { name: "HubSpot", text: "Create and update contacts from responses." },
  { name: "Mailchimp", text: "Add respondents to an audience." },
];

/** Integrations are out of scope for this build, so this page is a labelled placeholder. */
export default function ConnectPage() {
  const { form, notFound } = useForm();

  if (notFound) return <div className="flex min-h-screen items-center justify-center text-muted">Form not found.</div>;
  if (!form) return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <FormHeader formId={form.id} title={form.title} active="connect" />
      <main className="mx-auto w-full max-w-4xl flex-1 p-8">
        <h1 className="text-2xl">Connect</h1>
        <p className="mt-1 text-sm text-muted">Send your responses to the tools you already use. Integrations are coming soon.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((item) => (
            <section key={item.name} className="rounded-xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{item.name}</h2>
                <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs">Coming soon</span>
              </div>
              <p className="mt-2 text-sm text-muted">{item.text}</p>
              <button disabled className="mt-4 h-8 rounded-md bg-subtle px-3 text-sm text-muted">
                Connect
              </button>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
