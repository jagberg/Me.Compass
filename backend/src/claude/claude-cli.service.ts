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

  /**
   * Pulls the JSON payload out of the CLI's answer. The `claude` CLI can wrap its reply in a
   * ```json code fence, or (under an "explanatory" output style) prepend an "★ Insight ─" banner
   * or other prose, so we slice from the first array/object bracket to its matching last bracket.
   */
  private extractJson(text: string): string {
    const stripped = (() => {
      const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      return fenced ? fenced[1] : text;
    })().trim();

    const firstArr = stripped.indexOf("[");
    const firstObj = stripped.indexOf("{");
    let start = -1;
    let close = "";
    if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
      start = firstArr;
      close = "]";
    } else if (firstObj !== -1) {
      start = firstObj;
      close = "}";
    }
    if (start === -1) return stripped;
    const end = stripped.lastIndexOf(close);
    return end > start ? stripped.slice(start, end + 1) : stripped;
  }

  /** Extracts actionable items from a raw source item (email/chat message/meeting notes doc). */
  async extractActions(rawText: string, sourceLabel: string): Promise<ExtractedAction[]> {
    const prompt = `You extract actionable items owed by the reader from a ${sourceLabel} item.

Include an item as actionable when EITHER is true:
- Someone directly asks the reader to do something (an explicit ask of them)
- The reader states they will do something themselves (their own commitment)

Exclude an item when an action is assigned solely to someone other than the reader, with no
involvement from the reader - including when that person is reporting their own commitment
TO the reader for information (e.g. "Sarah will update the deck", or an email FROM Ivan
saying "I'll review this and send questions" - Ivan's commitment, not the reader's, even
though the reader received it).

If it's ambiguous whether the reader is involved, or the commitment is vague, INCLUDE it
rather than dropping it - prefer catching too much over missing something real.

The item may be a whole conversation (multiple messages separated by ---). If so, read all
of it together and capture only what is still owed by the end of the thread: collapse the
same request restated across messages into ONE action, and drop anything already resolved
later in the thread. Do not emit one action per message.

Return ONLY a JSON array (no prose), each element:
{"title": string, "description": string, "due_date": string|null (ISO YYYY-MM-DD), "due_date_inferred": boolean, "priority": "high"|"medium"|"low"|null, "suggested_next_step": string|null}
If the item states an explicit date/deadline, use it and set due_date_inferred=false.
If there is no explicit date but urgency is inferable from context, infer both due_date and priority and set due_date_inferred=true.
If there is no actionable item owed by the reader, return [].

Item:
${rawText}`;
    const result = await this.run(prompt);
    return JSON.parse(this.extractJson(result)) as ExtractedAction[];
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
    return JSON.parse(this.extractJson(result)) as { due_date: string; priority: Priority };
  }
}
