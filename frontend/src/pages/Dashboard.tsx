import { useEffect, useState } from "react";
import { Action, SourceConnection, SourceType } from "../api/types";
import { getActionsGrouped, getTodayActions } from "../api/actions";
import { getSources, triggerSync } from "../api/sources";
import { SourceGroup } from "../components/SourceGroup";
import { ViewToggle, ViewMode } from "../components/ViewToggle";
import { NextStepsList } from "../components/NextStepsList";
import { AddActionForm } from "../components/AddActionForm";

const SOURCE_ORDER: SourceType[] = ["email", "chat", "meeting", "manual"];

export function Dashboard() {
  const [grouped, setGrouped] = useState<Record<SourceType, Action[]> | null>(null);
  const [today, setToday] = useState<Action[]>([]);
  const [sources, setSources] = useState<SourceConnection[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  async function reload() {
    const [g, t, s] = await Promise.all([getActionsGrouped(), getTodayActions(), getSources()]);
    setGrouped(g);
    setToday(t);
    setSources(s);
  }

  useEffect(() => {
    reload();
  }, []);

  function handleActionChange(updated: Action) {
    const stillOpen = updated.status === "open";
    setGrouped((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next[updated.source_type] = stillOpen
        ? next[updated.source_type].map((a) => (a.id === updated.id ? updated : a))
        : next[updated.source_type].filter((a) => a.id !== updated.id);
      return next;
    });
    setToday((prev) => (stillOpen ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev.filter((a) => a.id !== updated.id)));
  }

  function handleCreated(action: Action) {
    setGrouped((prev) => (prev ? { ...prev, [action.source_type]: [...prev[action.source_type], action] } : prev));
  }

  async function handleSync(type: string) {
    try {
      await triggerSync(type);
    } finally {
      reload();
    }
  }

  if (!grouped) return <p>Loading…</p>;

  return (
    <div className="dashboard">
      <header>
        <h1>Action Manager</h1>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </header>

      <section className="sources-bar">
        {sources.map((s) => (
          <div key={s.source_type} className={`source-status source-status--${s.status}`}>
            <span>{s.source_type}</span>
            <span>{s.status}</span>
            {s.last_error && <span className="source-status__error">{s.last_error}</span>}
            <button onClick={() => handleSync(s.source_type)}>Sync</button>
          </div>
        ))}
      </section>

      <NextStepsList actions={today} onChange={handleActionChange} />

      <AddActionForm onCreated={handleCreated} />

      <div className={`dashboard__body dashboard__body--${viewMode}`}>
        {SOURCE_ORDER.map((sourceType) => (
          <SourceGroup key={sourceType} sourceType={sourceType} actions={grouped[sourceType]} onChange={handleActionChange} />
        ))}
      </div>
    </div>
  );
}
