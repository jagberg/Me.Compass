import { Action, SourceType } from "../api/types";
import { ActionCard } from "./ActionCard";

const LABELS: Record<SourceType, string> = {
  email: "Email",
  chat: "Chat",
  meeting: "Meetings",
  manual: "Manual",
};

function isOverdue(a: Action): boolean {
  return a.status === "open" && a.due_date !== null && a.due_date < new Date().toISOString().slice(0, 10);
}

export function SourceGroup({
  sourceType,
  actions,
  onChange,
}: {
  sourceType: SourceType;
  actions: Action[];
  onChange: (updated: Action) => void;
}) {
  if (actions.length === 0) return null;
  const overdueCount = actions.filter(isOverdue).length;
  return (
    <section className={`source-group source-group--${sourceType}`}>
      <div className="source-group__header">
        <h2>{LABELS[sourceType]}</h2>
        <span className="source-group__count">{actions.length}</span>
        {overdueCount > 0 && <span className="source-group__overdue-flag">{overdueCount} overdue</span>}
      </div>
      <ol>
        {actions.map((action) => (
          <li key={action.id}>
            <ActionCard action={action} onChange={onChange} />
          </li>
        ))}
      </ol>
    </section>
  );
}
