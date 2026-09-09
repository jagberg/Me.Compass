import { Body, Controller, Delete, Get, HttpCode, HttpException, Param, Patch, Post } from "@nestjs/common";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: { name: string; rule: string; icon?: string | null }) {
    if (!body?.name || !body?.rule) throw new HttpException("name and rule are required", 400);
    return this.service.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { name?: string; rule?: string; icon?: string | null }) {
    const updated = this.service.update(id, body);
    if (!updated) throw new HttpException("Category not found", 404);
    return updated;
  }

  @Delete(":id")
  @HttpCode(204)
  delete(@Param("id") id: string) {
    this.service.delete(id);
  }
}
