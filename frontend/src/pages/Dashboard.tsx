import { useEffect, useMemo, useState } from "react";
import { Action, SourceConnection, SourceType } from "../api/types";
import { getActionsGrouped, getTodayActions } from "../api/actions";
import { getSources, triggerSync } from "../api/sources";
import { SourceGroup } from "../components/SourceGroup";
import { ViewToggle, ViewMode } from "../components/ViewToggle";
import { NextStepsList } from "../components/NextStepsList";
import { AddActionForm } from "../components/AddActionForm";

const SOURCE_ORDER: SourceType[] = ["email", "chat", "meeting", "manual"];

const TODAY_LABEL = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

function Sidebar({ openCount }: { openCount: number }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">Me.Compass</div>
      <ul className="sidebar__nav">
        <li className="sidebar__nav-item">
          <span>Actions</span>
          {openCount > 0 && <span className="sidebar__badge">{openCount}</span>}
        </li>
      </ul>
      <div className="sidebar__section-label">Future modules</div>
      {["Notes", "Habits", "Finance"].map((m) => (
        <div className="sidebar__future-item" key={m}>
          <span>{m}</span>
          <span className="sidebar__soon">soon</span>
        </div>
      ))}
      <div className="sidebar__spacer" />
      <div className="sidebar__settings">Settings</div>
    </aside>
  );
}

export function Dashboard() {
  const [grouped, setGrouped] = useState<Record<SourceType, Action[]> | null>(null);
  const [today, setToday] = useState<Action[]>([]);
  const [sources, setSources] = useState<SourceConnection[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAdd, setShowAdd] = useState(false);

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
    setShowAdd(false);
  }

  async function handleSync(type: string) {
    try {
      await triggerSync(type);
    } finally {
      reload();
    }
  }

  const openCount = useMemo(
    () => (grouped ? Object.values(grouped).reduce((n, list) => n + list.length, 0) : 0),
    [grouped],
  );

  if (!grouped) {
    return (
      <div className="app-shell">
        <Sidebar openCount={0} />
        <main className="main">
          <p>Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar openCount={openCount} />
      <main className="main">
        <div className="page-header">
          <div className="page-header__title">
            <h1>Actions</h1>
            <span className="page-header__date">{TODAY_LABEL}</span>
          </div>
          <div className="page-header__right">
            <button className="quick-add" onClick={() => setShowAdd((v) => !v)}>
              Quick add… (q)
            </button>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>

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

        {showAdd && <AddActionForm onCreated={handleCreated} />}

        <NextStepsList actions={today} onChange={handleActionChange} />

        <div className={`dashboard__body dashboard__body--${viewMode}`}>
          {SOURCE_ORDER.map((sourceType) => (
            <SourceGroup key={sourceType} sourceType={sourceType} actions={grouped[sourceType]} onChange={handleActionChange} />
          ))}
        </div>
      </main>
    </div>
  );
}
