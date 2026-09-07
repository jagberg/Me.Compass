import { Body, Controller, Get, HttpCode, HttpException, Param, Patch, Post, Query } from "@nestjs/common";
import { ActionsService } from "./actions.service";
import { Status } from "../types";

@Controller("actions")
export class ActionsController {
  constructor(private readonly service: ActionsService) {}

  @Get()
  list(@Query("status") status?: Status, @Query("group_by") groupBy?: string) {
    const effectiveStatus = status ?? "open";
    return groupBy === "source"
      ? this.service.listGroupedBySource(effectiveStatus)
      : this.service.list(effectiveStatus);
  }

  @Get("today")
  today() {
    return this.service.today();
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: { title: string; description: string; due_date?: string; priority?: string }) {
    return this.service.create(body as never);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { due_date?: string; priority?: string; status?: string },
  ) {
    const updated = this.service.update(id, body as never);
    if (!updated) throw new HttpException("Action not found", 404);
    return updated;
  }

  @Post(":id/run")
  async run(@Param("id") id: string) {
    const { ok, result } = await this.service.run(id);
    if (!ok) throw new HttpException(result, 502);
    return result;
  }
}
