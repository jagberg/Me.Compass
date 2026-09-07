import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { GoogleAuthService } from "./google-auth.service";

export interface RawSourceItem {
  rawText: string;
  sourceUrl: string;
}

@Injectable()
export class GmailClient {
  constructor(private readonly auth: GoogleAuthService) {}

  /** Fetches message snippets received since `sinceIso` (or all recent mail on first sync). */
  async fetchSince(sinceIso: string | null): Promise<RawSourceItem[]> {
    const authClient = await this.auth.getClient();
    const gmail = google.gmail({ version: "v1", auth: authClient });
    const query = sinceIso ? `after:${Math.floor(new Date(sinceIso).getTime() / 1000)}` : "newer_than:7d";
    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 25 });
    const items: RawSourceItem[] = [];
    for (const msg of list.data.messages ?? []) {
      if (!msg.id) continue;
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const headers = full.data.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      items.push({
        rawText: `From: ${from}\nSubject: ${subject}\nSnippet: ${full.data.snippet ?? ""}`,
        sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
      });
    }
    return items;
  }
}
