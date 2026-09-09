import { Module } from "@nestjs/common";
import { SourcesController } from "./sources.controller";
import { SourcesService } from "./sources.service";
import { SourceConnectionRepository } from "./source-connection.repository";
import { GoogleAuthService } from "./google-auth.service";
import { GmailClient } from "./gmail.client";
import { DriveClient } from "./drive.client";
import { ChatClient } from "./chat.client";
import { ReconcileService } from "./reconcile.service";
import { MergeExceptionRepository } from "./merge-exception.repository";
import { ClaudeModule } from "../claude/claude.module";
import { ActionsModule } from "../actions/actions.module";
import { CategoriesModule } from "../categories/categories.module";
import { JiraModule } from "../jira/jira.module";

@Module({
  imports: [ClaudeModule, ActionsModule, CategoriesModule, JiraModule],
  controllers: [SourcesController],
  providers: [
    SourcesService,
    SourceConnectionRepository,
    GoogleAuthService,
    GmailClient,
    DriveClient,
    ChatClient,
    ReconcileService,
    MergeExceptionRepository,
  ],
  exports: [MergeExceptionRepository],
})
export class SourcesModule {}
