import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted">404</p>
      <h1 className="text-3xl">We couldn&apos;t find that page</h1>
      <Link href="/" className="mt-2 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-surface">
        Back to my workspace
      </Link>
    </div>
  );
}
