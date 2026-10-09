"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type FormPatch, type QuestionPatch } from "./api";
import type { Form, Question, QuestionType } from "./types";

/** How long to wait after the last keystroke before saving an edit. */
const SAVE_DELAY_MS = 500;

/** Temporary id for an option that the server has not seen yet. */
let nextTempId = -1;
export const tempOptionId = () => nextTempId--;

/** The question fields the builder can edit. */
export type QuestionEdit = Partial<Omit<Question, "id" | "position">>;

/** Local Question fields → API patch. New options (negative ids) are sent without an id. */
function toApiPatch(patch: QuestionEdit): QuestionPatch {
  const { options, logic_rules, ...rest } = patch;
  const apiPatch: QuestionPatch = rest;
  if (options) {
    apiPatch.options = options.map((option, index) => ({
      id: option.id > 0 ? option.id : undefined,
      label: option.label.trim() || `Choice ${index + 1}`,
    }));
  }
  if (logic_rules) {
    // Rules are replaced as a whole on the server, so their ids are not sent.
    apiPatch.logic_rules = logic_rules.map(({ operator, value, target_question_id }) => ({ operator, value, target_question_id }));
  }
  return apiPatch;
}

/**
 * State and actions for the form builder.
 *
 * Edits are applied to local state immediately (so typing feels instant) and saved to the
 * server after a short pause. Structural changes (add, delete, reorder, publish) save at once.
 */
export function useBuilder(formId: number, onError: (message: string) => void) {
  const [form, setForm] = useState<Form | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedId, setSelectedId] = useState<number | "ending" | null>(null);
  const [savesInFlight, setSavesInFlight] = useState(0);

  // Unsaved edits per question, plus one slot (key 0) for form-level fields.
  const pendingQuestions = useRef(new Map<number, QuestionPatch>());
  const pendingForm = useRef<FormPatch>({});
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    api
      .getForm(formId)
      .then((loaded) => {
        setForm(loaded);
        setSelectedId(loaded.questions[0]?.id ?? "ending");
      })
      .catch(() => setNotFound(true));
  }, [formId]);

  /** Run a save, tracking it for the "Saving…" indicator and reporting failures. */
  const track = useCallback(
    async <T,>(save: () => Promise<T>): Promise<T | undefined> => {
      setSavesInFlight((count) => count + 1);
      try {
        return await save();
      } catch {
        onError("Couldn't save your changes");
      } finally {
        setSavesInFlight((count) => count - 1);
      }
    },
    [onError],
  );

  const schedule = (key: number, flush: () => void, delay: number) => {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(flush, delay));
  };

  const replaceQuestion = (id: number, change: (question: Question) => Question) =>
    setForm((current) => current && { ...current, questions: current.questions.map((q) => (q.id === id ? change(q) : q)) });

  const flushQuestion = async (id: number) => {
    const patch = pendingQuestions.current.get(id);
    if (!patch) return;
    pendingQuestions.current.delete(id);
    const saved = await track(() => api.updateQuestion(id, patch));
    // Adopt what the server decided (real option ids, defaults after a type change),
    // unless the user has typed again in the meantime.
    if (saved && !pendingQuestions.current.has(id)) {
      replaceQuestion(id, (q) => ({ ...q, options: saved.options, settings: saved.settings, logic_rules: saved.logic_rules }));
    }
  };

  const updateQuestion = (id: number, patch: QuestionEdit) => {
    replaceQuestion(id, (q) => ({ ...q, ...patch }));
    pendingQuestions.current.set(id, { ...pendingQuestions.current.get(id), ...toApiPatch(patch) });
    // A type change alters which controls are shown, so save it straight away.
    schedule(id, () => flushQuestion(id), patch.type ? 0 : SAVE_DELAY_MS);
  };

  const updateForm = (patch: FormPatch) => {
    setForm((current) => current && { ...current, ...patch });
    pendingForm.current = { ...pendingForm.current, ...patch };
    schedule(
      0,
      () => {
        const toSave = pendingForm.current;
        pendingForm.current = {};
        void track(() => api.updateForm(formId, toSave));
      },
      SAVE_DELAY_MS,
    );
  };

  const addQuestion = async (type: QuestionType) => {
    const created = await track(() => api.addQuestion(formId, type));
    if (!created) return;
    setForm((current) => current && { ...current, questions: [...current.questions, created] });
    setSelectedId(created.id);
  };

  const deleteQuestion = async (id: number) => {
    if (!form) return;
    const remaining = form.questions
      .filter((q) => q.id !== id)
      // The server drops jumps that pointed at the deleted question; mirror that here.
      .map((q) => ({ ...q, logic_rules: q.logic_rules.filter((rule) => rule.target_question_id !== id) }));
    clearTimeout(timers.current.get(id));
    pendingQuestions.current.delete(id);
    setForm({ ...form, questions: remaining });
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? "ending");
    await track(() => api.deleteQuestion(id));
  };

  const reorderQuestions = async (orderedIds: number[]) => {
    if (!form) return;
    const byId = new Map(form.questions.map((q) => [q.id, q]));
    setForm({ ...form, questions: orderedIds.map((id, position) => ({ ...byId.get(id)!, position })) });
    const saved = await track(() => api.reorderQuestions(formId, orderedIds));
    if (!saved) return;
    // Reordering can remove jumps that would now point backwards; take the server's rules.
    const rules = new Map(saved.map((q) => [q.id, q.logic_rules]));
    setForm((current) => current && { ...current, questions: current.questions.map((q) => ({ ...q, logic_rules: rules.get(q.id) ?? q.logic_rules })) });
  };

  const setPublished = async (published: boolean) => {
    const saved = await track(() => (published ? api.publishForm(formId) : api.unpublishForm(formId)));
    if (saved) setForm((current) => current && { ...current, status: saved.status, published_at: saved.published_at });
    return saved !== undefined;
  };

  return {
    form,
    notFound,
    saving: savesInFlight > 0,
    selectedId,
    setSelectedId,
    updateForm,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    setPublished,
  };
}

export type Builder = ReturnType<typeof useBuilder>;
