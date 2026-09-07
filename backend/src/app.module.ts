import { Module } from "@nestjs/common";
import { ClaudeModule } from "./claude/claude.module";
import { ActionsModule } from "./actions/actions.module";
import { SourcesModule } from "./sources/sources.module";

@Module({
  imports: [ClaudeModule, ActionsModule, SourcesModule],
})
export class AppModule {}
