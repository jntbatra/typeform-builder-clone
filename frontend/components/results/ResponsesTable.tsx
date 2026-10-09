"use client";

import { useState } from "react";
import { TypeTile } from "@/components/builder/QuestionList";
import { Button } from "@/components/ui/Modal";
import type { FormResponse, Question } from "@/lib/types";
import { formatDate } from "@/lib/useForm";

interface ResponsesTableProps {
  questions: Question[];
  responses: FormResponse[];
  onDelete: (id: number) => Promise<void>;
}

/** Table of submissions; clicking a row opens that response in full in a side drawer. */
export function ResponsesTable({ questions, responses, onDelete }: ResponsesTableProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = responses.find((r) => r.id === openId);

  if (responses.length === 0) {
    return (
      <div className="mt-6 rounded-xl bg-surface p-12 text-center ring-1 ring-line">
        <p className="text-lg">No responses yet</p>
        <p className="mt-1 text-sm text-muted">Publish and share your form to start collecting answers.</p>
      </div>
    );
  }

  /** The answer as text, or as a download link when it is an uploaded file. */
  const answerOf = (response: FormResponse, questionId: number) => {
    const answer = response.answers.find((a) => a.question_id === questionId);
    if (!answer?.file_url) return answer?.value ?? "";
    return (
      <a href={answer.file_url} onClick={(event) => event.stopPropagation()} className="text-[#0445AF] underline dark:text-[#8ab4ff]">
        {answer.value}
      </a>
    );
  };

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-medium">Submitted</th>
              {questions.map((question) => (
                <th key={question.id} className="max-w-52 truncate px-4 py-3 font-medium" title={question.title}>
                  {question.title || "Untitled question"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr
                key={response.id}
                tabIndex={0}
                onClick={() => setOpenId(response.id)}
                onKeyDown={(event) => event.key === "Enter" && setOpenId(response.id)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-subtle"
              >
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(response.submitted_at)}</td>
                {questions.map((question) => (
                  <td key={question.id} className="max-w-52 truncate px-4 py-3">
                    {answerOf(response, question.id) || <span className="text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenId(null)}>
          <aside
            aria-label="Response details"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <h2 className="font-medium">Response #{open.id}</h2>
                <p className="text-sm text-muted">{formatDate(open.submitted_at)}</p>
              </div>
              <button aria-label="Close" onClick={() => setOpenId(null)} className="rounded p-1 text-muted hover:bg-subtle">
                ✕
              </button>
            </div>
            <ol className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              {questions.map((question, index) => (
                <li key={question.id}>
                  <div className="flex items-start gap-2.5 text-sm">
                    <TypeTile type={question.type} number={index + 1} />
                    <span className="text-muted">{question.title || "Untitled question"}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap pl-[58px]">
                    {answerOf(open, question.id) || <span className="text-muted">No answer</span>}
                  </p>
                </li>
              ))}
            </ol>
            <div className="border-t border-line p-4">
              <Button
                variant="danger"
                onClick={async () => {
                  await onDelete(open.id);
                  setOpenId(null);
                }}
              >
                Delete response
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
