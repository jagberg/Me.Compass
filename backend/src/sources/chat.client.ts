import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { GoogleAuthService } from "./google-auth.service";
import { RawSourceItem } from "./gmail.client";

@Injectable()
export class ChatClient {
  constructor(private readonly auth: GoogleAuthService) {}

  /** Fetches Google Chat messages across the user's spaces since `sinceIso`. */
  async fetchSince(sinceIso: string | null): Promise<RawSourceItem[]> {
    const authClient = await this.auth.getClient();
    const chat = google.chat({ version: "v1", auth: authClient });
    const spaces = await chat.spaces.list({ pageSize: 20 });
    const since = sinceIso ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const items: RawSourceItem[] = [];
    for (const space of spaces.data.spaces ?? []) {
      if (!space.name) continue;
      const messages = await chat.spaces.messages.list({
        parent: space.name,
        filter: `createTime > "${since}"`,
        pageSize: 20,
      });
      for (const msg of messages.data.messages ?? []) {
        if (!msg.text) continue;
        items.push({
          rawText: `Space: ${space.displayName ?? space.name}\nMessage: ${msg.text}`,
          sourceUrl: msg.name ? `https://chat.google.com/${msg.name}` : "https://chat.google.com",
        });
      }
    }
    return items;
  }
}
