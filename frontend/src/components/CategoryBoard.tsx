import { Action, Category, CategoryGroup } from "../api/types";
import { ActionLine } from "./ActionLine";
import { localTodayIso } from "../util/date";

function CategoryGroupBlock({
  group,
  categories,
  onChange,
  onSplit,
}: {
  group: CategoryGroup;
  categories: Category[];
  onChange: (a: Action) => void;
  onSplit: (a: Action[]) => void;
}) {
  const overdue = group.actions.filter((a) => a.due_date && a.due_date < localTodayIso()).length;
  return (
    <div className="catgroup">
      <div className="cat__head">
        <span className="cat__name">{group.category ? group.category.name : "Uncategorised"}</span>
        {overdue > 0 ? (
          <span className="urgency">{overdue} overdue</span>
        ) : (
          <span className="cat__count">{group.actions.length}</span>
        )}
      </div>
      <div className="cat__body">
        {group.actions.map((a) => (
          <ActionLine key={a.id} action={a} categories={categories} onChange={onChange} onSplit={onSplit} />
        ))}
      </div>
    </div>
  );
}

export function CategoryBoard({
  groups,
  categories,
  twoColumn,
  onChange,
  onSplit,
}: {
  groups: CategoryGroup[];
  categories: Category[];
  twoColumn: boolean;
  onChange: (a: Action) => void;
  onSplit: (a: Action[]) => void;
}) {
  if (!twoColumn) {
    return (
      <div className="board one">
        <div className="column">
          {groups.map((g) => (
            <CategoryGroupBlock
              key={g.category?.id ?? "uncat"}
              group={g}
              categories={categories}
              onChange={onChange}
              onSplit={onSplit}
            />
          ))}
        </div>
      </div>
    );
  }
  // Interleave so priority reads top-to-bottom across both columns.
  const colA = groups.filter((_, i) => i % 2 === 0);
  const colB = groups.filter((_, i) => i % 2 === 1);
  return (
    <div className="board">
      {[colA, colB].map((col, i) => (
        <div className="column" key={i}>
          {col.map((g) => (
            <CategoryGroupBlock
              key={g.category?.id ?? "uncat"}
              group={g}
              categories={categories}
              onChange={onChange}
              onSplit={onSplit}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
