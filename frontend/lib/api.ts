// Thin typed client for the backend. Every network call in the app goes through here.

import type { Form, FormResponse, FormStats, FormSummary, Question, QuestionType, RunnableForm } from "./types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
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
};

export type FormPatch = Partial<Pick<Form, "title" | "theme" | "thank_you_title" | "thank_you_message">>;

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
};
