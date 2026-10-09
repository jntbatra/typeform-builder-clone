"use client";

import { THEME_KEY } from "@/lib/theme";

/**
 * Light / dark switch for the creator's screens.
 *
 * The theme is a `data-theme` attribute on <html>; colours are CSS variables that change with it
 * (see globals.css). No React state: the two icons are swapped by CSS, so there is nothing to
 * get out of sync with the attribute set before hydration.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the switch still works for this visit.
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-ink"
    >
      <span className="dark:hidden">☾</span>
      <span className="hidden dark:inline">☀</span>
    </button>
  );
}
