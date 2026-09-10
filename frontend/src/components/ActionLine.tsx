import { useState } from "react";
import { Action, Category, RunResult, SourceType } from "../api/types";
import { runAction, updateAction, splitAction } from "../api/actions";
import { localTodayIso } from "../util/date";

const SRC_ICON: Record<SourceType, { glyph: string; title: string; cls: string }> = {
  email: { glyph: "✉", title: "Email", cls: "src-email" },
  chat: { glyph: "💬", title: "Chat", cls: "src-chat" },
  meeting: { glyph: "▤", title: "Meeting notes", cls: "src-meeting" },
  manual: { glyph: "✎", title: "Manual", cls: "src-manual" },
};

function todayIso() {
  return localTodayIso();
}

function DuePill({ action }: { action: Action }) {
  if (!action.due_date) return <span className="pill nodate">no date</span>;
  if (action.due_date < todayIso()) return <span className="pill overdue">overdue</span>;
  if (action.due_date <= new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10))
    return <span className="pill soon">{action.due_date.slice(5)}</span>;
  return <span className="pill nodate">{action.due_date.slice(5)}</span>;
}

export function ActionLine({
  action,
  categories,
  onChange,
  onSplit,
}: {
  action: Action;
  categories: Category[];
  onChange: (updated: Action) => void;
  onSplit: (actions: Action[]) => void;
}) {
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.title);

  const src = SRC_ICON[action.source_type];

  async function saveTitle() {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== action.title) await patch({ title: v });
    else setDraft(action.title); // blank or unchanged: keep the current title
  }

  async function handleRun() {
    setRunning(true);
    try {
      setRunResult((await runAction(action.id)) as RunResult);
    } finally {
      setRunning(false);
    }
  }

  async function patch(fields: Parameters<typeof updateAction>[1]) {
    onChange(await updateAction(action.id, fields));
  }

  return (
    <div className="line-wrap">
      <div className="line">
        <span className="lead">
          <DuePill action={action} />
        </span>
        <span className={`dot ${action.priority ?? "none"}`} />
        {action.source_url ? (
          <a
            className={`srcico ${src.cls}`}
            href={action.source_url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${src.title}`}
          >
            {src.glyph}
          </a>
        ) : (
          <span className={`srcico ${src.cls}`} title={src.title}>
            {src.glyph}
          </span>
        )}
        <div className="line__body">
          <div className="line__title">
            {action.conflict && <span className="badge-conflict">conflict</span>}
            {action.stale_review && <span className="badge-stale">resolved?</span>}
            {editing ? (
              <input
                className="line__title-input"
                value={draft}
                autoFocus
                aria-label="Edit title"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setDraft(action.title);
                    setEditing(false);
                  }
                }}
                onBlur={saveTitle}
              />
            ) : (
              <span
                className="line__title-text"
                title="Click to rename"
                onClick={() => {
                  setDraft(action.title);
                  setEditing(true);
                }}
              >
                {action.title}
              </span>
            )}
          </div>
          {action.suggested_next_step && (
            <div className="line__next">
              <span className="lbl">Next</span>
              <span className="txt">{action.suggested_next_step}</span>
            </div>
          )}
          {action.requested_by && <div className="line__req">from {action.requested_by}</div>}
        </div>
        {action.action_url ? (
          <a
            className="play"
            title={`Open ${action.action_target || "source"} to action this`}
            href={action.action_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            ▶
          </a>
        ) : action.suggested_next_step ? (
          <button className="play" title="Draft the next step" onClick={handleRun} disabled={running}>
            {running ? "…" : "▶"}
          </button>
        ) : null}
        <button className="tick" title="Mark done" aria-label="Mark done" onClick={() => patch({ status: "done" })}>
          ✓
        </button>
        <button className="line__toggle" onClick={() => setOpen((v) => !v)} aria-label="More">
          ⋯
        </button>
      </div>

      {open && (
        <div className="line__controls">
          <label>
            Category:{" "}
            <select
              value={action.category_id ?? ""}
              onChange={(e) => patch({ category_id: e.target.value || null })}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="link-btn" onClick={() => patch({ status: "dismissed" })}>
            Dismiss
          </button>
          {action.stale_review && (
            <button className="link-btn" onClick={() => patch({ stale_review: false })}>
              Keep open
            </button>
          )}
          {action.conflict && (
            <button className="link-btn" onClick={() => patch({ conflict: false })}>
              Resolve conflict
            </button>
          )}
          <button className="link-btn" onClick={async () => onSplit(await splitAction(action.id))}>
            Split merge
          </button>
        </div>
      )}

      {runResult && (
        <div className={`run-result run-result--${runResult.status}`}>
          <em>Draft (not sent):</em>
          <p>{runResult.status === "succeeded" ? runResult.content : runResult.error}</p>
        </div>
      )}
    </div>
  );
}
