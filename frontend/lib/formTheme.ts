// The look of a respondent-facing form: three colours and a font, chosen by the creator.
// (The creator screens' own light / dark theme is separate: see lib/theme.ts and globals.css.)

import type { Theme } from "./types";

export type FontKey = NonNullable<Theme["font"]>;

export const FONTS: Record<FontKey, { label: string; stack: string }> = {
  sans: { label: "Sans serif", stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  serif: { label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  mono: { label: "Monospace", stack: "ui-monospace, SFMono-Regular, Menlo, monospace" },
};

export const DEFAULT_THEME: Required<Theme> = {
  primary: "#0445AF",
  background: "#FFFFFF",
  text: "#000000",
  font: "sans",
};

/**
 * Inline style for the element that wraps a form. The CSS variables are what the .tf-* classes
 * in globals.css and the answer controls read, so one object themes everything inside.
 */
export function themeStyle(theme: Theme): React.CSSProperties {
  const resolved = { ...DEFAULT_THEME, ...theme };
  return {
    "--tf-primary": resolved.primary,
    "--tf-bg": resolved.background,
    "--tf-text": resolved.text,
    background: resolved.background,
    color: resolved.text,
    fontFamily: (FONTS[resolved.font] ?? FONTS.sans).stack,
  } as React.CSSProperties;
}
