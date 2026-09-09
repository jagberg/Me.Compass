import { Controller, Post } from "@nestjs/common";
import { JiraService } from "./jira.service";

@Controller("jira")
export class JiraController {
  constructor(private readonly jira: JiraService) {}

  /** Reconcile approval actions against JIRA on demand (also runs inside sync-all). */
  @Post("reconcile")
  reconcile() {
    return this.jira.reconcileApprovals();
  }
}
