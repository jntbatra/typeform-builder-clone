// Thin typed client for the backend. Every network call in the app goes through here.

import type { FileAnswer, Form, FormResponse, FormStats, FormSummary, LogicRule, Question, QuestionType, RunnableForm } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Per-question validation messages, keyed by question id (422 on submit). */
    public errors: Record<string, string> = {},
  ) {
    super(message);
  }
}

// The backend's free host sleeps when idle. While it wakes, the proxy answers 502/503/504
// (or the request fails outright), so reads are retried for a while instead of failing.
const WAKING_STATUSES = [502, 503, 504];
const RETRY_FOR_MS = 75_000;
const RETRY_EVERY_MS = 3_000;

async function fetchPatiently(url: string, init: RequestInit): Promise<Response> {
  // Only reads are repeated: sending a write twice could create two of something.
  const canRetry = !init.method || init.method === "GET";
  const giveUpAt = Date.now() + RETRY_FOR_MS;
  for (;;) {
    try {
      const response = await fetch(url, init);
      if (!canRetry || !WAKING_STATUSES.includes(response.status) || Date.now() > giveUpAt) return response;
    } catch (networkError) {
      if (!canRetry || Date.now() > giveUpAt) throw networkError;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_EVERY_MS));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchPatiently(`/api${path}`, {
    ...init,
    // JSON bodies are sent as strings; a FormData body (file upload) sets its own content type.
    headers: typeof init?.body === "string" ? { "Content-Type": "application/json" } : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.detail === "string" ? body.detail : "Something went wrong";
    throw new ApiError(message, response.status, body.errors);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export type QuestionPatch = Partial<Pick<Question, "type" | "title" | "description" | "required" | "settings">> & {
  options?: { id?: number; label: string }[];
  logic_rules?: Omit<LogicRule, "id">[];
};

export type FormPatch = Partial<
  Pick<Form, "title" | "theme" | "welcome_title" | "welcome_message" | "welcome_button" | "thank_you_title" | "thank_you_message">
>;

export const api = {
  listForms: () => request<FormSummary[]>("/forms"),
  createForm: (title: string) => request<Form>("/forms", json("POST", { title })),
  getForm: (id: number) => request<Form>(`/forms/${id}`),
  updateForm: (id: number, patch: FormPatch) => request<Form>(`/forms/${id}`, json("PATCH", patch)),
  deleteForm: (id: number) => request<void>(`/forms/${id}`, json("DELETE")),
  duplicateForm: (id: number) => request<Form>(`/forms/${id}/duplicate`, json("POST")),
  publishForm: (id: number) => request<Form>(`/forms/${id}/publish`, json("POST")),
  unpublishForm: (id: number) => request<Form>(`/forms/${id}/unpublish`, json("POST")),

  addQuestion: (formId: number, type: QuestionType, position?: number) =>
    request<Question>(`/forms/${formId}/questions`, json("POST", { type, position })),
  updateQuestion: (id: number, patch: QuestionPatch) => request<Question>(`/questions/${id}`, json("PATCH", patch)),
  duplicateQuestion: (id: number) => request<Question>(`/questions/${id}/duplicate`, json("POST")),
  deleteQuestion: (id: number) => request<void>(`/questions/${id}`, json("DELETE")),
  reorderQuestions: (formId: number, questionIds: number[]) =>
    request<Question[]>(`/forms/${formId}/questions/order`, json("PUT", { question_ids: questionIds })),

  listResponses: (formId: number) => request<FormResponse[]>(`/forms/${formId}/responses`),
  getStats: (formId: number) => request<FormStats>(`/forms/${formId}/stats`),
  deleteResponse: (id: number) => request<void>(`/responses/${id}`, json("DELETE")),
  exportUrl: (formId: number) => `/api/forms/${formId}/responses/export`,

  getPublicForm: (slug: string) => request<RunnableForm>(`/public/forms/${slug}`),
  recordView: (slug: string) => request<void>(`/public/forms/${slug}/views`, json("POST")),
  submitResponse: (slug: string, answers: { question_id: number; value: unknown }[]) =>
    request<{ id: number }>(`/public/forms/${slug}/responses`, json("POST", { answers })),
  /** Send the file for a file-upload question; the result is what gets submitted as its answer. */
  uploadFile: async (slug: string, questionId: number, file: File): Promise<FileAnswer> => {
    const body = new FormData();
    body.append("file", file);
    const saved = await request<{ id: string; filename: string }>(
      `/public/forms/${slug}/questions/${questionId}/uploads`,
      { method: "POST", body },
    );
    return { upload_id: saved.id, filename: saved.filename };
  },
};
