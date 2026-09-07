import { Injectable, Logger } from "@nestjs/common";
import { ActionsRepository } from "./actions.repository";
import { RunResultRepository } from "./run-result.repository";
import { ClaudeCliService } from "../claude/claude-cli.service";
import { Action, SourceType, Status } from "../types";

export interface CreateActionInput {
  title: string;
  description: string;
  due_date?: string | null;
  priority?: Action["priority"];
}

const TODAY_CAP = 6;

function isToday(dateIso: string): boolean {
  return dateIso === new Date().toISOString().slice(0, 10);
}

function isOverdue(action: Action): boolean {
  return action.status === "open" && action.due_date !== null && action.due_date < new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly repo: ActionsRepository,
    private readonly runResults: RunResultRepository,
    private readonly claude: ClaudeCliService,
  ) {}

  list(status?: Status): Action[] {
    return this.repo.list(status);
  }

  listGroupedBySource(status?: Status): Record<SourceType, Action[]> {
    const grouped: Record<SourceType, Action[]> = { email: [], chat: [], meeting: [], manual: [] };
    for (const action of this.repo.list(status)) {
      grouped[action.source_type].push(action);
    }
    return grouped;
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
    fields: Partial<Pick<Action, "due_date" | "priority" | "status">>,
  ): Action | undefined {
    const existing = this.repo.getById(id);
    if (!existing) return undefined;
    const patch: Partial<Action> = { ...fields };
    if (fields.due_date !== undefined && fields.due_date !== existing.due_date) {
      patch.due_date_inferred = false;
    }
    if (fields.status === "done" || fields.status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
    }
    return this.repo.update(id, patch);
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
