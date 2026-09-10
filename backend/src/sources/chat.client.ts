import { Injectable } from "@nestjs/common";
import { google, chat_v1 } from "googleapis";
import { GoogleAuthService } from "./google-auth.service";
import { RawSourceItem } from "./gmail.client";

const MAX_THREAD_CHARS = 8000;

/**
 * Turns a Chat resource path ("spaces/<S>/threads/<T>", or just "spaces/<S>" for a flat space) into
 * the web deep link the Chat app routes to: chat.google.com/room/<S>/<T>. Account pinning
 * (?authuser=) is added at serve time, not here, so the stored URL stays a stable stale-gating key.
 */
export function chatDeepLink(resourcePath: string): string {
  const m = resourcePath.match(/^spaces\/([^/]+)(?:\/threads\/([^/]+))?/);
  if (!m) return `https://chat.google.com/${resourcePath}`;
  const [, space, thread] = m;
  return `https://chat.google.com/room/${space}${thread ? `/${thread}` : ""}`;
}

@Injectable()
export class ChatClient {
  constructor(private readonly auth: GoogleAuthService) {}

  /**
   * Fetches Google Chat messages since `sinceIso`, grouped into one item per thread so extraction
   * reads the whole conversation (not one action per message). Each message carries its sender.
   */
  async fetchSince(sinceIso: string | null): Promise<RawSourceItem[]> {
    const authClient = await this.auth.getClient();
    const chat = google.chat({ version: "v1", auth: authClient });
    const spaces = await chat.spaces.list({ pageSize: 20 });
    const since = sinceIso ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const items: RawSourceItem[] = [];

    for (const space of spaces.data.spaces ?? []) {
      if (!space.name) continue;
      const res = await chat.spaces.messages.list({
        parent: space.name,
        filter: `createTime > "${since}"`,
        pageSize: 50,
      });
      const messages = res.data.messages ?? [];

      // Group by thread (fall back to the space itself for flat spaces).
      const byThread = new Map<string, chat_v1.Schema$Message[]>();
      for (const msg of messages) {
        if (!msg.text) continue;
        const threadKey = msg.thread?.name ?? space.name;
        const g = byThread.get(threadKey);
        if (g) g.push(msg);
        else byThread.set(threadKey, [msg]);
      }

      for (const [threadKey, threadMsgs] of byThread) {
        threadMsgs.sort((a, b) => (a.createTime ?? "").localeCompare(b.createTime ?? ""));
        const full = threadMsgs
          .map((m) => {
            const sender = m.sender?.displayName ?? m.sender?.name ?? "Unknown";
            return `From: ${sender}\nDate: ${m.createTime ?? ""}\n${m.text ?? ""}`;
          })
          .join("\n\n---\n\n");
        items.push({
          rawText: `Space: ${space.displayName ?? space.name}\n\n${full.slice(0, MAX_THREAD_CHARS)}`,
          // Key provenance on the stable thread id, not the first message in this sync's fragment,
          // so the same thread keeps one source_url across incremental syncs (stale gating relies on it).
          // Build the canonical web deep link: chat.google.com/room/<space>/<thread>, which the app
          // actually routes to (unlike the API's spaces/.../threads/... resource path). The reader's
          // ?authuser= is appended later, at serve time, from ME_EMAIL - see actions/destination.ts.
          sourceUrl: chatDeepLink(threadKey),
          truncated: full.length > MAX_THREAD_CHARS,
        });
      }
    }
    return items;
  }
}
