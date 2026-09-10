import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ActionsRepository } from "./actions.repository";
import { RunResultRepository } from "./run-result.repository";
import { CategoriesRepository } from "../categories/categories.repository";
import { MergeExceptionRepository } from "../sources/merge-exception.repository";
import { ClaudeCliService } from "../claude/claude-cli.service";
import { localTodayIso } from "../util/date";
import { withDestination } from "./destination";
import { Action, Category, SourceType, Status } from "../types";

export interface CreateActionInput {
  title: string;
  description: string;
  due_date?: string | null;
  priority?: Action["priority"];
}

export interface CategoryGroup {
  category: Category | null;
  actions: Action[];
}

const TODAY_CAP = 6;
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function isToday(dateIso: string): boolean {
  return dateIso === localTodayIso();
}

function isOverdue(action: Action): boolean {
  return action.status === "open" && action.due_date !== null && action.due_date < localTodayIso();
}

/** FR-021 comparator: overdue -> due-today -> future -> undated; then due asc, priority, created asc. */
function urgencyBucket(a: Action): number {
  if (a.due_date === null) return 3;
  const today = localTodayIso();
  if (a.due_date < today) return 0;
  if (a.due_date === today) return 1;
  return 2;
}

function compareUrgency(a: Action, b: Action): number {
  const bucket = urgencyBucket(a) - urgencyBucket(b);
  if (bucket !== 0) return bucket;
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  const pri = (PRIORITY_RANK[a.priority ?? ""] ?? 3) - (PRIORITY_RANK[b.priority ?? ""] ?? 3);
  if (pri !== 0) return pri;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly repo: ActionsRepository,
    private readonly runResults: RunResultRepository,
    private readonly categories: CategoriesRepository,
    private readonly mergeExceptions: MergeExceptionRepository,
    private readonly claude: ClaudeCliService,
  ) {}

  list(status?: Status): Action[] {
    return this.repo.list(status).map(withDestination);
  }

  listGroupedBySource(status?: Status): Record<SourceType, Action[]> {
    const grouped: Record<SourceType, Action[]> = { email: [], chat: [], meeting: [], manual: [] };
    for (const action of this.repo.list(status)) {
      grouped[action.source_type].push(action);
    }
    return grouped;
  }

  /** FR-008/FR-021: categories ranked by their most-urgent action; Uncategorised always last. */
  listGroupedByCategory(status?: Status): CategoryGroup[] {
    const actions = this.repo.list(status).map(withDestination);
    const categories = this.categories.list();
    const byId = new Map<string, Action[]>();
    const uncategorised: Action[] = [];
    for (const a of actions) {
      if (a.category_id && categories.some((c) => c.id === a.category_id)) {
        const g = byId.get(a.category_id);
        if (g) g.push(a);
        else byId.set(a.category_id, [a]);
      } else {
        uncategorised.push(a);
      }
    }
    const groups: CategoryGroup[] = categories
      .filter((c) => byId.has(c.id))
      .map((c) => ({ category: c, actions: byId.get(c.id)!.sort(compareUrgency) }));
    groups.sort((x, y) => compareUrgency(x.actions[0], y.actions[0]));
    if (uncategorised.length) {
      groups.push({ category: null, actions: uncategorised.sort(compareUrgency) }); // always last
    }
    return groups;
  }

  today(): Action[] {
    const open = this.repo.list("open");
    const overdue = open.filter(isOverdue);
    const dueToday = open.filter((a) => !isOverdue(a) && a.due_date !== null && isToday(a.due_date));
    const highPriority = open.filter((a) => !isOverdue(a) && !(a.due_date !== null && isToday(a.due_date)) && a.priority === "high");
    return [...overdue, ...dueToday, ...highPriority].slice(0, TODAY_CAP);
  }

  async create(input: CreateActionInput): Promise<Action> {
    let due_date = input.due_date ?? null;
    let priority = input.priority ?? null;
    let due_date_inferred = false;
    if (!due_date) {
      const inferred = await this.claude.inferDueDateAndPriority(input.title, input.description);
      due_date = inferred.due_date;
      priority = priority ?? inferred.priority;
      due_date_inferred = true;
    }
    return this.repo.insert({
      title: input.title,
      description: input.description,
      source_type: "manual",
      source_url: null,
      due_date,
      due_date_inferred,
      priority,
      suggested_next_step: null,
    });
  }

  update(
    id: string,
    fields: Partial<Pick<Action, "title" | "due_date" | "priority" | "status" | "category_id" | "conflict" | "stale_review">>,
  ): Action | undefined {
    const existing = this.repo.getById(id);
    if (!existing) return undefined;
    const patch: Partial<Action> = { ...fields };
    // A user title edit is authoritative: reject blank, otherwise pin it (FR-003, FR-004).
    if (fields.title !== undefined) {
      const trimmed = fields.title.trim();
      if (!trimmed) throw new HttpException("Title cannot be blank", 400);
      patch.title = trimmed;
      patch.title_pinned = true;
    }
    if (fields.due_date !== undefined && fields.due_date !== existing.due_date) {
      patch.due_date_inferred = false;
    }
    if (fields.status === "done" || fields.status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
    }
    // Any explicit category assignment (including null = Uncategorised) pins it (FR-020).
    if (fields.category_id !== undefined) {
      patch.category_pinned = true;
    }
    return this.repo.update(id, patch);
  }

  /** Undo a wrong merge: re-insert each folded snapshot as its own action and remember the split. */
  split(id: string): Action[] {
    const action = this.repo.getById(id);
    if (!action || !action.merged_from || action.merged_from.length === 0) {
      return action ? [action] : [];
    }
    const results: Action[] = [action];
    const splitTs = Date.now();
    action.merged_from.forEach((snap, i) => {
      // Give the split-off a distinct identity (index-suffixed so same-millisecond splits never
      // collide) and record the exception so reconcile won't re-merge.
      const splitKey = snap.dedup_key ? `${snap.dedup_key}#split-${splitTs}-${i}` : null;
      if (action.dedup_key && splitKey) this.mergeExceptions.add(action.dedup_key, splitKey);
      results.push(
        this.repo.insert({
          title: snap.title,
          description: snap.description,
          source_type: snap.source_type,
          source_url: snap.source_url,
          due_date: snap.due_date,
          due_date_inferred: snap.due_date_inferred ?? false,
          priority: snap.priority,
          suggested_next_step: snap.suggested_next_step,
          requested_by: snap.requested_by,
          dedup_key: splitKey,
          // Preserve filing: fall back to the parent's category since a split-off is the same task.
          category_id: snap.category_id ?? action.category_id,
          category_pinned: (snap.category_id ?? action.category_id) ? true : false,
        }),
      );
    });
    // The kept action no longer holds the absorbed snapshots.
    this.repo.setDigestFields(id, { merged_from: null });
    return results;
  }

  async run(id: string): Promise<{ ok: boolean; result: ReturnType<RunResultRepository["insert"]> }> {
    const action = this.repo.getById(id);
    if (!action) throw new Error("Action not found");
    try {
      const content = await this.claude.run(
        `Draft the following next step for review only — do not assume it will be sent or executed:\n\nAction: ${action.title}\nContext: ${action.description}\nNext step: ${action.suggested_next_step ?? "Draft an appropriate next step."}`,
      );
      return { ok: true, result: this.runResults.insert(id, content, "succeeded", null) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Run failed for action ${id}: ${message}`);
      return { ok: false, result: this.runResults.insert(id, "", "failed", message) };
    }
  }
}
