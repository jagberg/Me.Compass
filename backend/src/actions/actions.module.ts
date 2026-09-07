import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { ActionsRepository } from "./actions.repository";
import { RunResultRepository } from "./run-result.repository";
import { ClaudeModule } from "../claude/claude.module";

@Module({
  imports: [ClaudeModule],
  controllers: [ActionsController],
  providers: [ActionsService, ActionsRepository, RunResultRepository],
  exports: [ActionsRepository],
})
export class ActionsModule {}
