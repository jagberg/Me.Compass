import { useState } from "react";
import { Action, RunResult } from "../api/types";
import { runAction, updateAction } from "../api/actions";

function isOverdue(action: Action): boolean {
  return action.status === "open" && action.due_date !== null && action.due_date < new Date().toISOString().slice(0, 10);
}

export function ActionCard({ action, onChange }: { action: Action; onChange: (updated: Action) => void }) {
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const overdue = isOverdue(action);

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

  return (
    <div className={`action-card${overdue ? " action-card--overdue" : ""}`}>
      <div className="action-card__header">
        <strong>{action.title}</strong>
        {overdue && <span className="badge badge--overdue">Overdue</span>}
      </div>
      <p>{action.description}</p>
      <div className="action-card__meta">
        <label>
          Due:{" "}
          <input
            type="date"
            value={action.due_date ?? ""}
            onChange={(e) => handleDueDateChange(e.target.value)}
          />
          {action.due_date_inferred && <span className="badge">inferred</span>}
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
      </div>
      <div className="action-card__actions">
        {action.suggested_next_step && (
          <button onClick={handleRun} disabled={running}>
            {running ? "Running…" : "Run"}
          </button>
        )}
        <button onClick={handleDone}>Done</button>
        <button onClick={handleDismiss}>Dismiss</button>
      </div>
      {runResult && (
        <div className={`run-result run-result--${runResult.status}`}>
          <em>Draft result (not sent):</em>
          <p>{runResult.status === "succeeded" ? runResult.content : runResult.error}</p>
        </div>
      )}
    </div>
  );
}
