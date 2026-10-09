# Formflow — a Typeform-style form builder

Build a form in a drag-and-drop builder, publish it to a shareable link, collect answers through a
one-question-at-a-time conversational flow, and read the results.

- **Frontend:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, dnd-kit, Framer Motion
- **Backend:** Python, FastAPI, SQLAlchemy 2, Pydantic 2
- **Database:** SQLite

## Features

| Area | What works |
| --- | --- |
| Form builder | Add, edit, drag-to-reorder and delete questions. Nine types: short text, long text, multiple choice, dropdown, email, number, yes/no, rating, file upload. Required toggle, description, placeholder, inline editing on a live canvas, full-screen preview. Edits autosave. Usable on a phone (one panel at a time). |
| Form management | List with status, response count and completion rate. Create, rename, duplicate, delete. Publish / unpublish with a public link. |
| Respondent flow | One question per screen with slide transitions, progress bar, Enter to continue, arrow keys to move, letter / number shortcuts for choices and ratings, auto-advance on pick, client and server validation, thank-you screen. No login. |
| Results | Summary stats per question (counts, averages, recent answers), responses table, single response drawer, delete. |
| Logic jumps | Per-question rules ("if the answer is X, go to question Y" or "to the end"). The respondent flow follows them, Back retraces the path actually taken, and the server validates only the questions that were shown. |
| File upload | Click-or-drop upload (5 MB limit) stored with the response and downloadable from the results. |
| Dark mode | Light / dark switch for the creator screens, remembered per browser. |
| Other bonus | Custom themes (presets and colour pickers), CSV export, view tracking and completion rate. |
| Placeholders | Integrations / webhooks, team sharing, embed, scoring and payment questions are marked "Coming soon". |

## Run it locally

Requires Python 3.11+ and Node 20+.

```bash
# 1. Backend — http://localhost:8000 (API docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Frontend — http://localhost:3000
cd frontend
npm install
npm run dev
```

The database file `backend/formflow.db` is created and seeded on first start with two published
forms, one draft, and 23 sample responses. To reset it: `python -m app.seed --reset`.

Try the seeded public forms at `/to/feedback` and `/to/devconf`.

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Nineteen API tests cover ordering and reordering, option editing, publish rules, server-side
validation, logic jumps, file uploads, stats, duplication and cascading deletes. Each test runs against its own throwaway
database.

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `BACKEND_URL` | frontend | `http://127.0.0.1:8000` | Where Next.js proxies `/api/*` |
| `DATABASE_URL` | backend | `sqlite:///./formflow.db` | SQLAlchemy database URL |
| `CORS_ORIGINS` | backend | `http://localhost:3000` | Only needed if a browser calls the API directly |

## Architecture

```
Browser ──► Next.js (frontend/)  ──/api/* rewrite──►  FastAPI (backend/)  ──►  SQLite
```

The browser only talks to the Next.js origin. `next.config.ts` rewrites `/api/*` to the FastAPI
server, so there is no CORS setup and the API address lives in one environment variable.

```
backend/app/
  main.py          app setup, CORS, routers, seed on startup
  database.py      engine, session, foreign-key pragma
  models.py        SQLAlchemy models (the schema)
  schemas.py       Pydantic request / response shapes
  validation.py    server-side answer validation
  logic.py         logic jumps: which questions a respondent is shown
  deps.py          current creator, ownership checks
  seed.py          sample data
  routers/
    forms.py       form CRUD, duplicate, publish
    questions.py   add / edit / reorder / delete questions
    responses.py   response list, single response, stats, CSV
    public.py      anonymous: load a published form, upload a file, submit a response

frontend/
  app/
    page.tsx                    dashboard
    forms/[id]/create           builder
    forms/[id]/share|results|connect
    to/[slug]                   public respondent page
  components/
    respondent/FormRunner.tsx   the one-question-at-a-time flow (also used by the builder preview)
    respondent/AnswerInput.tsx  the answer control for each question type
    builder/                    QuestionList (drag and drop), QuestionCanvas, SettingsPanel, LogicEditor
    results/                    Summary, ResponsesTable
    ui/                         Modal, Menu, Toast, Toggle, ThemeToggle, AutoTextarea
  lib/
    api.ts          the only place that calls the backend
    useBuilder.ts   builder state: optimistic edits, debounced autosave
    questions.ts    question type metadata and client-side validation
    logic.ts        logic jumps (mirrors backend/app/logic.py)
    types.ts        shared TypeScript types
```

Design decisions worth knowing:

- **One runner, two uses.** `FormRunner` drives both the public page and the builder preview, so the
  preview cannot drift from what respondents see.
- **Optimistic autosave.** Builder edits update local state immediately and are sent to the API
  500 ms after the last keystroke. Structural changes (add, delete, reorder, publish) save at once.
- **Logic runs on both sides.** The browser uses the jump rules to pick the next question; the API
  walks the same path on submit, so a required question that a jump skipped is not reported as
  missing and answers to questions that were never shown are discarded. Jumps only go forward,
  which makes loops impossible.
- **Dark mode is a second set of CSS variables.** Components use colour tokens (`bg-surface`,
  `text-ink`), and `<html data-theme="dark">` swaps their values. The respondent form is not
  affected: its colours come from the form's own theme.
- **Validation twice.** The browser validates for fast feedback; the API re-validates every
  submission because the public endpoint can be called directly. A rejected submission returns the
  failing question ids and the runner jumps to the first one.

## Database schema

```
creators 1───* forms 1───* questions 1───* question_options
                     │               1───* logic_rules *───1 questions (jump target)
                     1───* responses 1───* answers *───1 questions
                                           answers 1───0..1 uploads
```

| Table | Columns | Notes |
| --- | --- | --- |
| `creators` | `id`, `name`, `email` (unique) | One seeded default creator stands in for auth. |
| `forms` | `id`, `creator_id` → creators, `title`, `slug` (unique), `status` (draft / published), `theme` (JSON), `thank_you_title`, `thank_you_message`, `view_count`, `created_at`, `updated_at`, `published_at` | `slug` is a random public id, so share links cannot be guessed from numeric ids. |
| `questions` | `id`, `form_id` → forms, `type`, `title`, `description`, `required`, `position`, `settings` (JSON) | `position` gives the order. `settings` holds type-specific extras such as rating size or placeholder. |
| `question_options` | `id`, `question_id` → questions, `label`, `position` | Choices for multiple choice and dropdown. |
| `logic_rules` | `id`, `question_id` → questions, `operator`, `value`, `target_question_id` → questions (nullable), `position` | "If the answer to `question_id` `operator` `value`, go to `target_question_id`". A null target means the end of the form. For choice questions `value` is the option id, so renaming an option does not break the rule. |
| `responses` | `id`, `form_id` → forms, `submitted_at` | One row per submission. |
| `answers` | `id`, `response_id` → responses, `question_id` → questions, `option_id` → question_options (nullable), `value_text`, `value_number` | Unique on (`response_id`, `question_id`). |
| `uploads` | `id` (random token), `question_id` → questions, `answer_id` → answers (nullable, unique), `filename`, `content_type`, `size`, `data` (BLOB), `created_at` | The file of a file-upload answer. `answer_id` is null between upload and submit. |

- Children are removed with their parent (`ON DELETE CASCADE`): deleting a form removes its
  questions, options, responses and answers.
- `answers.option_id` is `ON DELETE SET NULL` and `value_text` keeps the label that was picked, so a
  response stays readable after the creator edits or removes that option.
- `value_number` is filled for number and rating answers so averages are computed in SQL.
- Deleting a question also deletes the rules that jump to it, and deleting an answer deletes its file.

## API overview

All routes are under `/api`. Interactive docs: `http://localhost:8000/docs`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/forms` | List forms with question and response counts |
| POST | `/forms` | Create a draft form |
| GET / PATCH / DELETE | `/forms/{id}` | Read, update (title, theme, thank-you screen), delete |
| POST | `/forms/{id}/duplicate` | Copy the form definition as a new draft |
| POST | `/forms/{id}/publish`, `/forms/{id}/unpublish` | Toggle the public link |
| POST | `/forms/{id}/questions` | Add a question |
| PUT | `/forms/{id}/questions/order` | Save a new question order |
| PATCH / DELETE | `/questions/{id}` | Edit (including its options and logic rules) or delete a question |
| GET | `/forms/{id}/responses` | All responses of a form |
| GET | `/forms/{id}/responses/export` | Responses as CSV |
| GET | `/forms/{id}/stats` | Views, completion rate, per-question summary |
| GET / DELETE | `/responses/{id}` | One response in full, or delete it |
| GET | `/uploads/{id}` | Download an uploaded file |
| GET | `/public/forms/{slug}` | Public: a published form (404 for drafts) |
| POST | `/public/forms/{slug}/views` | Public: count a view |
| POST | `/public/forms/{slug}/questions/{id}/uploads` | Public: upload a file for a file-upload question |
| POST | `/public/forms/{slug}/responses` | Public: submit answers (422 with per-question errors) |

## Deploying

- **Backend (Render, Railway or similar):** root directory `backend`, build
  `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend (Vercel):** root directory `frontend`, environment variable `BACKEND_URL` set to the
  backend's public URL.

## Assumptions

- Creator authentication is out of scope. Every creator request acts as one seeded default creator,
  resolved in a single dependency (`deps.get_current_creator`) so real auth can replace it.
- Multiple choice is single-select.
- A form needs at least one question before it can be published.
- A "view" is counted each time the public page loads; completion rate is responses ÷ views.
- Uploaded files are stored in the database (5 MB each) so they live and die with their answer.
  A file that is uploaded but never submitted stays as an orphan row; there is no clean-up job.
- There are no migrations. After a schema change, reset the database with `python -m app.seed --reset`.
- On hosts with an ephemeral disk, SQLite is re-created and re-seeded when the service restarts.
  A persistent disk or a hosted database (via `DATABASE_URL`) avoids that.
