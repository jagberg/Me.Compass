import { FormEvent, useState } from "react";
import { Category } from "../api/types";
import { createCategory, deleteCategory, updateCategory } from "../api/categories";

export function ManageCategories({
  categories,
  uncategorisedCount,
  onChanged,
}: {
  categories: Category[];
  uncategorisedCount: number;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [rule, setRule] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name || !rule) return;
    await createCategory({ name, rule });
    setName("");
    setRule("");
    onChanged();
  }

  return (
    <div className="manage">
      <div className="taxo">
        {categories.map((c) => (
          <div className="taxo__cat" key={c.id}>
            <div className="taxo__body">
              <input
                className="taxo__name-input"
                defaultValue={c.name}
                onBlur={(e) => e.target.value !== c.name && updateCategory(c.id, { name: e.target.value }).then(onChanged)}
              />
              <textarea
                className="taxo__rule-input"
                defaultValue={c.rule}
                onBlur={(e) => e.target.value !== c.rule && updateCategory(c.id, { rule: e.target.value }).then(onChanged)}
              />
            </div>
            <button className="link-btn" onClick={() => deleteCategory(c.id).then(onChanged)}>
              Delete
            </button>
          </div>
        ))}
        <div className="taxo__cat uncat">
          <div className="taxo__body">
            <div className="taxo__name">Uncategorised</div>
            <div className="taxo__rule">{uncategorisedCount} action(s) need filing</div>
          </div>
        </div>
      </div>

      <form className="add-cat" onSubmit={handleAdd}>
        <h3>Add category</h3>
        <input placeholder="Name (e.g. Software Renewals)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Filing rule (what belongs here)" value={rule} onChange={(e) => setRule(e.target.value)} />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
