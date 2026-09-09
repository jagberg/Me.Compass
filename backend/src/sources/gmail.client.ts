import { Injectable } from "@nestjs/common";
import { google, gmail_v1 } from "googleapis";
import { GoogleAuthService } from "./google-auth.service";

export interface RawSourceItem {
  rawText: string;
  sourceUrl: string;
  /** True when the transcript was cut at the char cap, so an ask past the cut may be missing.
   * Truncated items must not count as a full read for stale gating (FR-018). */
  truncated: boolean;
}

// Cap the text we hand the extractor per thread, so a long back-and-forth stays within a
// reasonable prompt size while still giving it the whole conversation.
const MAX_THREAD_CHARS = 8000;

@Injectable()
export class GmailClient {
  constructor(private readonly auth: GoogleAuthService) {}

  /** Recursively pulls the plain-text body out of a message payload (prefers text/plain over html). */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return "";
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, "base64").toString("utf8");
      if (payload.mimeType === "text/plain" || !payload.mimeType?.startsWith("multipart")) {
        return decoded;
      }
    }
    const parts = payload.parts ?? [];
    const plain = parts.find((p) => p.mimeType === "text/plain");
    if (plain) return this.extractBody(plain);
    // fall back to concatenating whatever text we can find in the parts tree
    return parts.map((p) => this.extractBody(p)).join("\n");
  }

  /** Fetches threads with activity since `sinceIso` (or recent threads on first sync), one item per thread. */
  async fetchSince(sinceIso: string | null): Promise<RawSourceItem[]> {
    const authClient = await this.auth.getClient();
    const gmail = google.gmail({ version: "v1", auth: authClient });
    // Do NOT filter to is:unread: an ask in an email the user has already opened (e.g. read on
    // their phone) still owes them an action, so read state must not gate extraction.
    const query = sinceIso
      ? `after:${Math.floor(new Date(sinceIso).getTime() / 1000)}`
      : "newer_than:7d";
    const list = await gmail.users.threads.list({ userId: "me", q: query, maxResults: 25 });
    const items: RawSourceItem[] = [];
    for (const thread of list.data.threads ?? []) {
      if (!thread.id) continue;
      const full = await gmail.users.threads.get({ userId: "me", id: thread.id, format: "full" });
      const messages = full.data.messages ?? [];
      if (messages.length === 0) continue;

      const firstHeaders = messages[0].payload?.headers ?? [];
      const subject = firstHeaders.find((h) => h.name === "Subject")?.value ?? "(no subject)";

      // Assemble the whole thread as one chronological transcript so extraction sees the
      // full conversation and can capture the single thing owed, not one action per message.
      const transcript = messages
        .map((msg) => {
          const headers = msg.payload?.headers ?? [];
          const from = headers.find((h) => h.name === "From")?.value ?? "";
          const date = headers.find((h) => h.name === "Date")?.value ?? "";
          const body = this.extractBody(msg.payload).trim() || msg.snippet || "";
          return `From: ${from}\nDate: ${date}\n${body}`;
        })
        .join("\n\n---\n\n");

      items.push({
        rawText: `Subject: ${subject}\n\n${transcript.slice(0, MAX_THREAD_CHARS)}`,
        sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${thread.id}`,
        truncated: transcript.length > MAX_THREAD_CHARS,
      });
    }
    return items;
  }
}
