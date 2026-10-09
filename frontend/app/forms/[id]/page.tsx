"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** /forms/:id has no content of its own; send it to the builder. */
export default function FormIndexPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => router.replace(`/forms/${id}/create`), [id, router]);
  return null;
}
