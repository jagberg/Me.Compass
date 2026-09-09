import { useEffect, useMemo, useState } from "react";
import { Action, Category, CategoryGroup, SourceConnection } from "../api/types";
import { getActionsByCategory } from "../api/actions";
import { getCategories } from "../api/categories";
import { getSources, syncAll } from "../api/sources";
import { CategoryBoard } from "../components/CategoryBoard";
import { ManageCategories } from "../components/ManageCategories";

const TODAY_LABEL = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

type ViewMode = "two" | "one" | "manage";

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
  const [groups, setGroups] = useState<CategoryGroup[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<SourceConnection[]>([]);
  const [view, setView] = useState<ViewMode>("two");
  const [syncing, setSyncing] = useState(false);

  async function reload() {
    const [g, c, s] = await Promise.all([getActionsByCategory(), getCategories(), getSources()]);
    setGroups(g);
    setCategories(c);
    setSources(s);
  }

  useEffect(() => {
    reload();
  }, []);

  const openCount = useMemo(
    () => (groups ? groups.reduce((n, grp) => n + grp.actions.length, 0) : 0),
    [groups],
  );
  const uncategorisedCount = useMemo(
    () => groups?.find((g) => g.category === null)?.actions.length ?? 0,
    [groups],
  );

  function handleActionChange(_updated: Action) {
    reload(); // a change can move an action between categories or resolve it
  }

  function handleSplit(_actions: Action[]) {
    reload();
  }

  async function handleSyncAll() {
    setSyncing(true);
    try {
      await syncAll();
    } finally {
      setSyncing(false);
      reload();
    }
  }

  if (!groups) {
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
            <button className="sync-btn" onClick={handleSyncAll} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync all"}
            </button>
            <div className="switch">
              <button aria-pressed={view === "two"} onClick={() => setView("two")}>
                Two columns
              </button>
              <button aria-pressed={view === "one"} onClick={() => setView("one")}>
                Single rail
              </button>
              <button aria-pressed={view === "manage"} onClick={() => setView("manage")}>
                Manage
              </button>
            </div>
          </div>
        </div>

        <section className="sources-bar">
          {sources.map((s) => (
            <div key={s.source_type} className={`source-status source-status--${s.status}`}>
              <span>{s.source_type}</span>
              <span>{s.status}</span>
              {s.last_error && <span className="source-status__error">{s.last_error}</span>}
            </div>
          ))}
        </section>

        {view === "manage" ? (
          <ManageCategories categories={categories} uncategorisedCount={uncategorisedCount} onChanged={reload} />
        ) : (
          <CategoryBoard
            groups={groups}
            categories={categories}
            twoColumn={view === "two"}
            onChange={handleActionChange}
            onSplit={handleSplit}
          />
        )}
      </main>
    </div>
  );
}
