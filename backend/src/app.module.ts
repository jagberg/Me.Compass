import { Module } from "@nestjs/common";
import { ClaudeModule } from "./claude/claude.module";
import { ActionsModule } from "./actions/actions.module";
import { SourcesModule } from "./sources/sources.module";
import { CategoriesModule } from "./categories/categories.module";
import { JiraModule } from "./jira/jira.module";

@Module({
  imports: [ClaudeModule, ActionsModule, SourcesModule, CategoriesModule, JiraModule],
})
export class AppModule {}
