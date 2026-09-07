import { Module } from "@nestjs/common";
import { SourcesController } from "./sources.controller";
import { SourcesService } from "./sources.service";
import { SourceConnectionRepository } from "./source-connection.repository";
import { GoogleAuthService } from "./google-auth.service";
import { GmailClient } from "./gmail.client";
import { DriveClient } from "./drive.client";
import { ChatClient } from "./chat.client";
import { ClaudeModule } from "../claude/claude.module";
import { ActionsModule } from "../actions/actions.module";

@Module({
  imports: [ClaudeModule, ActionsModule],
  controllers: [SourcesController],
  providers: [SourcesService, SourceConnectionRepository, GoogleAuthService, GmailClient, DriveClient, ChatClient],
})
export class SourcesModule {}
