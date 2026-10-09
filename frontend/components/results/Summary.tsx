import { TypeTile } from "@/components/builder/QuestionList";
import type { FormStats, QuestionStats } from "@/lib/types";

function BigNumber({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-black/5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl">{value}</p>
    </div>
  );
}

/** Horizontal bars: one per choice, sized by its share of the answers. */
function CountBars({ stats }: { stats: QuestionStats }) {
  return (
    <ul className="flex flex-col gap-2">
      {stats.counts.map((item) => {
        const share = stats.answered ? Math.round((item.count / stats.answered) * 100) : 0;
        return (
          <li key={item.label} className="text-sm">
            <div className="mb-1 flex justify-between">
              <span>{item.label}</span>
              <span className="text-muted">
                {item.count} · {share}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-[#0445AF]" style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionSummary({ stats, number, total }: { stats: QuestionStats; number: number; total: number }) {
  return (
    <section className="rounded-xl bg-white p-6 ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <TypeTile type={stats.type} number={number} />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">{stats.title || "Untitled question"}</h2>
          <p className="text-sm text-muted">
            {stats.answered} out of {total} people answered this question
          </p>
        </div>
      </div>

      <div className="mt-4">
        {stats.average !== null && (
          <p className="mb-3 text-sm">
            <span className="text-2xl">{stats.average}</span> <span className="text-muted">average</span>
            {stats.type === "number" && (
              <span className="text-muted"> · min {stats.minimum} · max {stats.maximum}</span>
            )}
          </p>
        )}
        {stats.counts.length > 0 && <CountBars stats={stats} />}
        {stats.samples.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {stats.samples.map((sample, index) => (
              <li key={index} className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
                {sample}
              </li>
            ))}
          </ul>
        )}
        {stats.answered === 0 && <p className="text-sm text-muted">No answers yet.</p>}
      </div>
    </section>
  );
}

/** Headline numbers plus a per-question breakdown. */
export function Summary({ stats }: { stats: FormStats }) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <BigNumber label="Views" value={String(stats.view_count)} />
        <BigNumber label="Responses" value={String(stats.response_count)} />
        <BigNumber label="Completion rate" value={stats.completion_rate === null ? "—" : `${stats.completion_rate}%`} />
      </div>
      {stats.questions.map((question, index) => (
        <QuestionSummary key={question.question_id} stats={question} number={index + 1} total={stats.response_count} />
      ))}
    </div>
  );
}
