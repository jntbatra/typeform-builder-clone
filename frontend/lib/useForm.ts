"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type LoadProblem, problemOf } from "./api";
import type { Form } from "./types";

/** Load the form named by the `[id]` route segment. Used by the read-mostly form pages. */
export function useForm() {
  const formId = Number(useParams<{ id: string }>().id);
  const [form, setForm] = useState<Form | null>(null);
  const [problem, setProblem] = useState<LoadProblem | null>(null);

  useEffect(() => {
    api.getForm(formId).then(setForm).catch((error) => setProblem(problemOf(error)));
  }, [formId]);

  return { formId, form, setForm, problem };
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
