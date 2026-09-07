import { Controller, Get, HttpException, Param, Post } from "@nestjs/common";
import { SourcesService } from "./sources.service";
import { SourceConnectionRepository } from "./source-connection.repository";
import { ConnectionSourceType } from "../types";

@Controller("sources")
export class SourcesController {
  constructor(
    private readonly service: SourcesService,
    private readonly repo: SourceConnectionRepository,
  ) {}

  @Get()
  list() {
    return this.repo.getAll();
  }

  @Post(":type/sync")
  async sync(@Param("type") type: ConnectionSourceType) {
    try {
      const { actionsCreated } = await this.service.sync(type);
      return { source: this.repo.getOne(type), actions_created: actionsCreated };
    } catch {
      throw new HttpException(this.repo.getOne(type) ?? {}, 502);
    }
  }
}
