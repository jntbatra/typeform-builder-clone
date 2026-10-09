"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { QUESTION_TYPE_ORDER, QUESTION_TYPES } from "@/lib/questions";
import type { Question, QuestionType } from "@/lib/types";
import type { Builder } from "@/lib/useBuilder";

/** Coloured tile with the type glyph and the question number, as in Typeform's sidebar. */
export function TypeTile({ type, number }: { type: QuestionType; number?: number }) {
  const meta = QUESTION_TYPES[type];
  return (
    <span
      className="flex h-6 w-12 shrink-0 items-center justify-between rounded px-1.5 text-xs font-medium text-[#262627]"
      style={{ background: meta.color }}
    >
      <span aria-hidden>{meta.glyph}</span>
      {number}
    </span>
  );
}

interface RowProps {
  question: Question;
  number: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableRow({ question, number, selected, onSelect, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // The whole row is the drag handle; a small drag distance keeps plain clicks working.
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${
        selected ? "bg-subtle-strong" : "hover:bg-subtle"
      } ${isDragging ? "relative z-10 bg-surface shadow-lg" : ""}`}
    >
      <TypeTile type={question.type} number={number} />
      <span className={`min-w-0 flex-1 truncate ${question.title ? "" : "text-muted"}`}>{question.title || "…"}</span>
      {question.logic_rules.length > 0 && (
        <span title="Has logic jumps" aria-label="Has logic jumps" className="text-xs text-muted">
          ⤳
        </span>
      )}
      <button
        aria-label={`Delete question ${number}`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        // Stop the press from starting a drag.
        onPointerDown={(event) => event.stopPropagation()}
        className="rounded px-1 text-muted opacity-0 hover:bg-subtle-strong hover:text-ink focus:opacity-100 group-hover:opacity-100"
      >
        ✕
      </button>
    </li>
  );
}

function AddQuestionMenu({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-subtle text-sm font-medium hover:bg-subtle-strong"
      >
        <span className="text-base leading-none">+</span> Add content
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-30 w-60 rounded-lg border border-line bg-surface p-2 shadow-xl">
            <p className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted">Question types</p>
            {QUESTION_TYPE_ORDER.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setOpen(false);
                  onAdd(type);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-subtle"
              >
                <TypeTile type={type} />
                {QUESTION_TYPES[type].label}
              </button>
            ))}
            <p className="mt-1 border-t border-line px-2 pt-2 text-xs text-muted">
              Payment questions are coming soon.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** Left sidebar of the builder: the ordered, drag-to-reorder list of questions. */
interface QuestionListProps {
  builder: Builder;
  className?: string;
  /** Called after the user picks or adds an item, so the page can bring the editor into view. */
  onNavigate?: () => void;
}

export function QuestionList({ builder, className = "flex", onNavigate }: QuestionListProps) {
  const { form, selectedId } = builder;
  const select = (id: number | "ending") => {
    builder.setSelectedId(id);
    onNavigate?.();
  };
  const add = async (type: QuestionType) => {
    await builder.addQuestion(type);
    onNavigate?.();
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (!form) return null;
  const ids = form.questions.map((q) => q.id);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    void builder.reorderQuestions(reordered);
  };

  return (
    <aside className={`w-full shrink-0 flex-col border-r border-line bg-surface md:w-64 ${className}`}>
      <div className="p-3">
        <AddQuestionMenu onAdd={add} />
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {form.questions.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted">No questions yet. Add your first one above.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-0.5">
              {form.questions.map((question, index) => (
                <SortableRow
                  key={question.id}
                  question={question}
                  number={index + 1}
                  selected={selectedId === question.id}
                  onSelect={() => select(question.id)}
                  onDelete={() => builder.deleteQuestion(question.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
      <div className="border-t border-line p-2">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">Endings</p>
        <button
          onClick={() => select("ending")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm ${
            selectedId === "ending" ? "bg-subtle-strong" : "hover:bg-subtle"
          }`}
        >
          <span className="flex h-6 w-12 shrink-0 items-center justify-center rounded bg-subtle-strong text-xs">☰</span>
          <span className="truncate">{form.thank_you_title || "Thank you screen"}</span>
        </button>
      </div>
    </aside>
  );
}
