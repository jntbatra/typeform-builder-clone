"use client";

import { useEffect, useState } from "react";

/** After this long, assume the backend is cold-starting and say so. */
const SLOW_AFTER_MS = 4000;

/**
 * Loading state for a page or a section.
 *
 * The demo backend runs on free hosting that sleeps when idle, and waking it can take up to
 * a minute. A bare "Loading…" for that long looks broken, so after a few seconds this explains
 * the wait. (lib/api.ts keeps retrying in the meantime.)
 */
export function Loading({ fullScreen = true }: { fullScreen?: boolean }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-muted ${fullScreen ? "min-h-screen" : "py-16"}`}>
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
      <p role="status">{slow ? "Waking up the server…" : "Loading…"}</p>
      {slow && (
        <p className="max-w-xs text-center text-xs">
          This demo runs on free hosting that sleeps when idle. The first load can take up to a minute.
        </p>
      )}
    </div>
  );
}
