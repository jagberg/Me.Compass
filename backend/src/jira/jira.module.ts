import { Module } from "@nestjs/common";
import { ActionsModule } from "../actions/actions.module";
import { JiraClient } from "./jira.client";
import { JiraService } from "./jira.service";
import { JiraController } from "./jira.controller";

@Module({
  imports: [ActionsModule],
  controllers: [JiraController],
  providers: [JiraClient, JiraService],
  exports: [JiraService],
})
export class JiraModule {}
