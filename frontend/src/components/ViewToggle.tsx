export type ViewMode = "list" | "panel";

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="view-toggle">
      <button disabled={mode === "list"} onClick={() => onChange("list")}>
        List
      </button>
      <button disabled={mode === "panel"} onClick={() => onChange("panel")}>
        Panels
      </button>
    </div>
  );
}
