import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { Priority } from "../types";

const TIMEOUT_MS = 30_000;

export interface ExtractedAction {
  title: string;
  description: string;
  due_date: string | null;
  due_date_inferred: boolean;
  priority: Priority | null;
  suggested_next_step: string | null;
}

@Injectable()
export class ClaudeCliService {
  /** Runs `claude -p --output-format json`, feeding `prompt` via stdin, and parses the JSON `result` field. */
  async run(prompt: string): Promise<string> {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        "claude",
        ["-p", "--output-format", "json"],
        { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        },
      );
      child.stdin?.write(prompt);
      child.stdin?.end();
    });
    const parsed = JSON.parse(stdout);
    return parsed.result as string;
  }

  /** Extracts actionable items from a raw source item (email/chat message/meeting notes doc). */
  async extractActions(rawText: string, sourceLabel: string): Promise<ExtractedAction[]> {
    const prompt = `You extract actionable to-dos owed by the reader from a ${sourceLabel} item.
Return ONLY a JSON array (no prose), each element:
{"title": string, "description": string, "due_date": string|null (ISO YYYY-MM-DD), "due_date_inferred": boolean, "priority": "high"|"medium"|"low"|null, "suggested_next_step": string|null}
If the item states an explicit date/deadline, use it and set due_date_inferred=false.
If there is no explicit date but urgency is inferable from context, infer both due_date and priority and set due_date_inferred=true.
If there is no actionable item owed by the reader, return [].

Item:
${rawText}`;
    const result = await this.run(prompt);
    return JSON.parse(result) as ExtractedAction[];
  }

  /** Infers a due_date + priority for an action that has neither, from its title/description. */
  async inferDueDateAndPriority(
    title: string,
    description: string,
  ): Promise<{ due_date: string; priority: Priority }> {
    const prompt = `Given this owed action with no due date, infer a reasonable due_date (ISO YYYY-MM-DD) and priority ("high"|"medium"|"low") from context and urgency language. Return ONLY JSON: {"due_date": string, "priority": string}.

Title: ${title}
Description: ${description}`;
    const result = await this.run(prompt);
    return JSON.parse(result) as { due_date: string; priority: Priority };
  }
}
