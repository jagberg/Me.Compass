import { FormEvent, useState } from "react";
import { createAction } from "../api/actions";
import { Action } from "../api/types";

export function AddActionForm({ onCreated }: { onCreated: (action: Action) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await createAction({
        title,
        description,
        due_date: dueDate || undefined,
        priority: priority || undefined,
      });
      onCreated(created);
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-action-form" onSubmit={handleSubmit}>
      <h2>Add action</h2>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="">Priority (optional)</option>
        <option value="high">high</option>
        <option value="medium">medium</option>
        <option value="low">low</option>
      </select>
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
