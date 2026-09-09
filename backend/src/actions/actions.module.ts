import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { ActionsRepository } from "./actions.repository";
import { RunResultRepository } from "./run-result.repository";
import { MergeExceptionRepository } from "../sources/merge-exception.repository";
import { ClaudeModule } from "../claude/claude.module";
import { CategoriesModule } from "../categories/categories.module";

@Module({
  imports: [ClaudeModule, CategoriesModule],
  controllers: [ActionsController],
  providers: [ActionsService, ActionsRepository, RunResultRepository, MergeExceptionRepository],
  exports: [ActionsRepository],
})
export class ActionsModule {}
