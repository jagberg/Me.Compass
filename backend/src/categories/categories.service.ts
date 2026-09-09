import { Injectable } from "@nestjs/common";
import { CategoriesRepository } from "./categories.repository";
import { Category } from "../types";

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  list(): Category[] {
    return this.repo.list();
  }

  create(input: { name: string; rule: string; icon?: string | null }): Category {
    return this.repo.create(input);
  }

  update(id: string, fields: { name?: string; rule?: string; icon?: string | null }): Category | undefined {
    return this.repo.update(id, fields);
  }

  delete(id: string): void {
    this.repo.delete(id);
  }
}
