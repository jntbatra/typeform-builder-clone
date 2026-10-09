"use client";

import Link from "next/link";
import type { LoadProblem } from "@/lib/api";
import { Button } from "./Modal";

/**
 * Shown when a page's data could not be loaded.
 * "missing" = the server said it does not exist (404); "failed" = anything else, worth a retry.
 */
export function LoadError({ problem, what = "form" }: { problem: LoadProblem; what?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      {problem === "missing" ? (
        <>
          <h1 className="text-2xl">We couldn&apos;t find that {what}</h1>
          <p className="text-sm text-muted">It may have been deleted, or the link may be wrong.</p>
          <Link href="/" className="mt-2 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-surface">
            Back to my workspace
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl">Something went wrong</h1>
          <p className="text-sm text-muted">We couldn&apos;t load this page. The server may be starting up.</p>
          <Button className="mt-2" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
