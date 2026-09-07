import { Action, SourceType } from "../api/types";
import { ActionCard } from "./ActionCard";

const LABELS: Record<SourceType, string> = {
  email: "Email",
  chat: "Chat",
  meeting: "Meetings",
  manual: "Manual",
};

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
  return (
    <section className="source-group">
      <h2>{LABELS[sourceType]}</h2>
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} onChange={onChange} />
      ))}
    </section>
  );
}
