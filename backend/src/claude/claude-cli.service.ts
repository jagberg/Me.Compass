import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { Priority } from "../types";

const TIMEOUT_MS = 30_000;

// The single user this local tool serves. Used so extraction knows who "the reader" is and can
// tell an ask aimed at them apart from one aimed at a different named person (e.g. "@Someone else").
const ME_NAME = process.env.ME_NAME ?? "Justin Goldberg";
const ME_EMAIL = process.env.ME_EMAIL ?? "justin.goldberg@compareclub.com.au";

export interface ExtractedAction {
  title: string;
  description: string;
  due_date: string | null;
  due_date_inferred: boolean;
  priority: Priority | null;
  suggested_next_step: string | null;
  /** Who is asking this of the reader: a person's name where known, else a role, else null. */
  requested_by: string | null;
  /** Canonical identity `verb:subject[:instance]` (lowercase); paraphrases share it, recurring instances differ. */
  dedup_key: string | null;
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

The reader is ${ME_NAME} (${ME_EMAIL}). "The reader" means this person specifically. In a chat
transcript each message is prefixed with "From: <sender>"; a message the reader sent is one whose
sender is ${ME_NAME}.

Include an item as actionable when EITHER is true:
- Someone directly asks the reader to do something (an explicit ask of them)
- The reader states they will do something themselves (their own commitment)

Exclude an item when an action is assigned solely to someone other than the reader, with no
involvement from the reader - including when that person is reporting their own commitment
TO the reader for information (e.g. "Sarah will update the deck", or an email FROM Ivan
saying "I'll review this and send questions" - Ivan's commitment, not the reader's, even
though the reader received it).

CRITICAL - directed at someone else: exclude any ask that is addressed to a DIFFERENT named
person, not the reader. A chat message like "@Gemma Howells - can you share the deck?" is an ask
of Gemma, NOT of the reader, even though the reader can see it in the space. An @-mention of, or a
task explicitly handed to, anyone who is not ${ME_NAME} means that item belongs to them - drop it.
Only treat a directed ask as the reader's when it names or @-mentions the reader, or is plainly
aimed at them. This exclusion overrides the "prefer catching too much" rule below.

CRITICAL - general asks in a group space: in a multi-person space, a GENERAL question or request
put to the room ("can anyone tell me where the list is?", "any concern with switching X?", "should
we hold this?", "check with the SLT") is NOT the reader's action UNLESS one of these holds:
  (a) the reader is @-mentioned or named, OR
  (b) the surrounding messages are a reply to something the reader themselves sent, or follow up on
      something previously asked of the reader (the reader is already the addressed party in context).
A general ask to nobody in particular, in a thread the reader has not been pulled into, belongs to
whoever picks it up - not automatically the reader. Do NOT create an action for the reader from it.
Someone else stating their own plan ("I'll validate the CIDRs", "let me raise a ticket") is likewise
that person's, not the reader's.

If it's ambiguous whether the reader is involved, or the commitment is vague, INCLUDE it
rather than dropping it - prefer catching too much over missing something real. (But a clear
ask directed at another named person is not "ambiguous" - exclude it per the rule above.)

The item may be a whole conversation (multiple messages separated by ---). If so, read all
of it together and capture only what is still owed by the end of the thread: collapse the
same request restated across messages into ONE action, and drop anything already resolved
later in the thread. Do not emit one action per message.

For each action also identify:
- "requested_by": who is asking this of the reader. Use the sender's name if the item names one
  (e.g. an email From header or a chat sender line); otherwise a role/team (e.g. "People & Culture",
  "Security lead"); null only if truly unknowable.
- "dedup_key": a canonical identity string, lowercase, of the form "verb:subject[:instance]", so
  paraphrases of the SAME task share the key and DIFFERENT instances differ. Include an instance
  qualifier whenever the task recurs by ticket or period. Examples: "approve:cm-389",
  "approve:payroll:te0001:2026-08b" (a specific pay period), "reduce:ghas-seats". Two different
  pay periods or two different tickets MUST get different keys.

Return ONLY a JSON array (no prose), each element:
{"title": string, "description": string, "due_date": string|null (ISO YYYY-MM-DD), "due_date_inferred": boolean, "priority": "high"|"medium"|"low"|null, "suggested_next_step": string|null, "requested_by": string|null, "dedup_key": string|null}
If the item states an explicit date/deadline, use it and set due_date_inferred=false.
If there is no explicit date but urgency is inferable from context, infer both due_date and priority and set due_date_inferred=true.
If there is no actionable item owed by the reader, return [].

Item:
${rawText}`;
    const result = await this.run(prompt);
    return JSON.parse(this.extractJson(result)) as ExtractedAction[];
  }

  /** Derives a canonical dedup_key + requester for an existing action (used by the one-time backfill). */
  async deriveIdentity(
    title: string,
    description: string,
  ): Promise<{ dedup_key: string | null; requested_by: string | null }> {
    const prompt = `Given this to-do, return ONLY JSON {"dedup_key": string|null, "requested_by": string|null}.
dedup_key is a canonical identity "verb:subject[:instance]" (lowercase); include an instance qualifier (ticket/period) for recurring tasks so different instances differ. requested_by is who asked it (name or role) or null.

Title: ${title}
Description: ${description}`;
    const result = await this.run(prompt);
    return JSON.parse(this.extractJson(result)) as { dedup_key: string | null; requested_by: string | null };
  }

  /** Model equivalence check for candidates whose dedup_keys are close but not equal (paraphrase drift). */
  async areSameTask(a: string, b: string): Promise<boolean> {
    const prompt = `Are these two to-do items the same underlying task (same request, same instance) rather than two different or two recurring tasks? Answer ONLY "yes" or "no".
A: ${a}
B: ${b}`;
    const result = (await this.run(prompt)).trim().toLowerCase();
    return result.startsWith("y");
  }

  /** Files an action into one of the user's categories by rule, or null (Uncategorised). */
  async classifyCategory(
    title: string,
    description: string,
    categories: { id: string; name: string; rule: string }[],
  ): Promise<string | null> {
    if (categories.length === 0) return null;
    const list = categories.map((c) => `- ${c.id} | ${c.name}: ${c.rule}`).join("\n");
    const prompt = `Choose the single best category id for this action, or "none" if nothing fits.
Return ONLY the id (or "none"), no prose.

Categories:
${list}

Action title: ${title}
Action description: ${description}`;
    const result = (await this.run(prompt)).trim();
    const match = categories.find((c) => result.includes(c.id));
    return match ? match.id : null;
  }

  /**
   * Judges whether a chat thread's new delta messages satisfy an action's captured resolution ask.
   * Returns exactly one of the three literals - never throws a parse error itself; on a genuinely
   * unparseable answer it falls back to "still-open" (a no-op), the same conservative default the
   * caller applies to a thrown/CLI error (see reconcile.service.ts's resolveChatActions - FR-010).
   */
  async judgeChatResolution(resolutionAsk: string, deltaText: string): Promise<"resolved" | "unsure" | "still-open"> {
    const prompt = `A chat thread has an open ask. Judge whether the NEW messages below (the delta
since the last check) show that ask has been satisfactorily resolved.

The ask: ${resolutionAsk}

New messages since last check:
${deltaText}

Answer with EXACTLY ONE of these three words, nothing else:
- resolved (the new messages clearly show the ask has been answered/handled - by anyone in the
  thread, not only the person who was asked)
- unsure (the new messages might relate to the ask but it's not clear whether it's actually resolved)
- still-open (the new messages don't address the ask at all, or clearly show it's still pending)`;
    const result = (await this.run(prompt)).trim().toLowerCase();
    if (result.includes("resolved")) return "resolved";
    if (result.includes("unsure")) return "unsure";
    return "still-open";
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
