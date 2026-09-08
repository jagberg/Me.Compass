import { useState } from "react";
import { Action, RunResult } from "../api/types";
import { runAction, updateAction } from "../api/actions";

function isOverdue(action: Action): boolean {
  return action.status === "open" && action.due_date !== null && action.due_date < new Date().toISOString().slice(0, 10);
}

function isToday(action: Action): boolean {
  return action.due_date === new Date().toISOString().slice(0, 10);
}

function DueBadge({ action }: { action: Action }) {
  if (!action.due_date) return <span className="pill pill--none">no date</span>;
  if (isOverdue(action)) return <span className="pill pill--overdue">overdue</span>;
  if (isToday(action)) return <span className="pill pill--today">Today</span>;
  return <span className="pill pill--upcoming">{action.due_date}</span>;
}

export function ActionCard({
  action,
  onChange,
  index,
}: {
  action: Action;
  onChange: (updated: Action) => void;
  index?: number;
}) {
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const result = (await runAction(action.id)) as RunResult;
      setRunResult(result);
    } finally {
      setRunning(false);
    }
  }

  async function handleDueDateChange(value: string) {
    onChange(await updateAction(action.id, { due_date: value || undefined } as never));
  }

  async function handlePriorityChange(value: string) {
    onChange(await updateAction(action.id, { priority: value || undefined } as never));
  }

  async function handleDismiss() {
    onChange(await updateAction(action.id, { status: "dismissed" }));
  }

  async function handleDone() {
    onChange(await updateAction(action.id, { status: "done" }));
  }

  const subtitle = action.suggested_next_step ?? action.description;

  return (
    <div className="action-row-wrap">
      <div className="action-row">
        {index !== undefined ? (
          <div className="action-row__index">{index}</div>
        ) : (
          <div className={`action-row__dot action-row__dot--${action.priority ?? "low"}`} />
        )}
        <div className="action-row__body">
          <div className="action-row__title-line">
            <span>{action.title}</span>
          </div>
          {subtitle && (
            <div className="action-row__sub" title={subtitle}>
              {action.suggested_next_step && <span className="action-row__sub-arrow">→</span>}
              {subtitle}
            </div>
          )}
        </div>
        <div className="action-row__right">
          <DueBadge action={action} />
          {action.due_date_inferred && <span className="pill pill--inferred">inferred</span>}
          {action.suggested_next_step && (
            <button className="btn-run" onClick={handleRun} disabled={running}>
              {running ? "Running…" : "Run"}
            </button>
          )}
          <button className="action-row__toggle" onClick={() => setEditing((v) => !v)} aria-label="Edit">
            ⋯
          </button>
        </div>
      </div>

      {editing && (
        <div className="action-row__edit">
          <label>
            Due:{" "}
            <input type="date" value={action.due_date ?? ""} onChange={(e) => handleDueDateChange(e.target.value)} />
          </label>
          <label>
            Priority:{" "}
            <select value={action.priority ?? ""} onChange={(e) => handlePriorityChange(e.target.value)}>
              <option value="">—</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>
          {action.source_url && (
            <a href={action.source_url} target="_blank" rel="noreferrer">
              source
            </a>
          )}
          <button className="link-btn" onClick={handleDone}>
            Done
          </button>
          <button className="link-btn" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {runResult && (
        <div className={`run-result run-result--${runResult.status}`}>
          <em>Draft result (not sent):</em>
          <p>{runResult.status === "succeeded" ? runResult.content : runResult.error}</p>
        </div>
      )}
    </div>
  );
}
