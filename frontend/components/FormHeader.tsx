"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-sm font-bold text-surface" aria-label="Formflow">
      F
    </span>
  );
}

/** Top bar shared by every page of a single form: breadcrumb, section tabs, actions. */
export function FormHeader({ formId, title, active, onRename, children }: FormHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center border-b border-line bg-surface px-4 md:h-14 md:flex-nowrap">
      <div className="flex h-14 min-w-0 flex-1 items-center gap-2 text-sm">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="hidden shrink-0 text-muted hover:text-ink sm:inline">
          My workspace
        </Link>
        <span className="hidden text-muted sm:inline">/</span>
        {onRename ? (
          <input
            aria-label="Form title"
            value={title}
            onChange={(event) => onRename(event.target.value)}
            className="min-w-0 max-w-64 flex-1 truncate rounded px-1.5 py-1 outline-none hover:bg-subtle focus:bg-subtle"
          />
        ) : (
          <span className="truncate px-1.5">{title}</span>
        )}
      </div>

      <nav className="order-last flex h-10 w-full items-stretch justify-center gap-6 md:order-none md:h-full md:w-auto">
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

      <div className="flex h-14 items-center justify-end gap-2 md:flex-1">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
