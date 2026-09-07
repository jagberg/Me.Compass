import { Action } from "../api/types";
import { ActionCard } from "./ActionCard";

export function NextStepsList({ actions, onChange }: { actions: Action[]; onChange: (updated: Action) => void }) {
  if (actions.length === 0) return null;
  return (
    <section className="next-steps">
      <h2>Today's next steps</h2>
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
