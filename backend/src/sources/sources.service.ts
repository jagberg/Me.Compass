import { Injectable, Logger } from "@nestjs/common";
import { ClaudeCliService } from "../claude/claude-cli.service";
import { ActionsRepository } from "../actions/actions.repository";
import { SourceConnectionRepository } from "./source-connection.repository";
import { GmailClient } from "./gmail.client";
import { DriveClient } from "./drive.client";
import { ChatClient } from "./chat.client";
import { ConnectionSourceType, SourceType } from "../types";

const SOURCE_LABEL: Record<ConnectionSourceType, string> = {
  gmail: "email",
  drive: "meeting notes",
  chat: "chat message",
};
const ACTION_SOURCE_TYPE: Record<ConnectionSourceType, SourceType> = {
  gmail: "email",
  drive: "meeting",
  chat: "chat",
};

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly claude: ClaudeCliService,
    private readonly actionsRepo: ActionsRepository,
    private readonly connectionsRepo: SourceConnectionRepository,
    private readonly gmail: GmailClient,
    private readonly drive: DriveClient,
    private readonly chatClient: ChatClient,
  ) {}

  async sync(type: ConnectionSourceType): Promise<{ actionsCreated: number }> {
    const connection = this.connectionsRepo.getOne(type);
    const client = { gmail: this.gmail, drive: this.drive, chat: this.chatClient }[type];

    try {
      const rawItems = await client.fetchSince(connection?.last_synced_at ?? null);
      let actionsCreated = 0;
      for (const item of rawItems) {
        const extracted = await this.claude.extractActions(item.rawText, SOURCE_LABEL[type]);
        for (const action of extracted) {
          this.actionsRepo.insert({
            title: action.title,
            description: action.description,
            source_type: ACTION_SOURCE_TYPE[type],
            source_url: item.sourceUrl,
            due_date: action.due_date,
            due_date_inferred: action.due_date_inferred,
            priority: action.priority,
            suggested_next_step: action.suggested_next_step,
          });
          actionsCreated++;
        }
      }
      this.connectionsRepo.upsert(type, {
        status: "connected",
        last_synced_at: new Date().toISOString(),
        last_error: null,
      });
      return { actionsCreated };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync failed for ${type}: ${message}`);
      this.connectionsRepo.upsert(type, { status: "error", last_error: message });
      throw error;
    }
  }
}
