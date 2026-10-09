"use client";

import Link from "next/link";

const TABS = [
  { key: "create", label: "Create" },
  { key: "connect", label: "Connect" },
  { key: "share", label: "Share" },
  { key: "results", label: "Results" },
] as const;

export type FormTab = (typeof TABS)[number]["key"];

interface FormHeaderProps {
  formId: number;
  title: string;
  active: FormTab;
  /** When given, the title becomes an inline-editable field. */
  onRename?: (title: string) => void;
  /** Right-hand actions (Preview, Publish...). */
  children?: React.ReactNode;
}

export function Logo() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-sm font-bold text-white" aria-label="Formflow">
      F
    </span>
  );
}

/** Top bar shared by every page of a single form: breadcrumb, section tabs, actions. */
export function FormHeader({ formId, title, active, onRename, children }: FormHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-line bg-white px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="shrink-0 text-muted hover:text-ink">
          My workspace
        </Link>
        <span className="text-muted">/</span>
        {onRename ? (
          <input
            aria-label="Form title"
            value={title}
            onChange={(event) => onRename(event.target.value)}
            className="min-w-0 max-w-64 flex-1 truncate rounded px-1.5 py-1 outline-none hover:bg-neutral-100 focus:bg-neutral-100"
          />
        ) : (
          <span className="truncate px-1.5">{title}</span>
        )}
      </div>

      <nav className="flex h-full items-stretch gap-6">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/forms/${formId}/${tab.key}`}
            className={`flex items-center border-b-2 text-sm ${
              active === tab.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2">{children}</div>
    </header>
  );
}
