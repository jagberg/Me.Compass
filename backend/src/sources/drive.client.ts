import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { GoogleAuthService } from "./google-auth.service";
import { RawSourceItem } from "./gmail.client";

// Cap the doc text handed to the extractor. Without this a long meeting-notes doc produces a
// prompt large enough to make the `claude` CLI exit non-zero ("Command failed"), which fails the
// whole Drive sync and leaves its cursor un-advanced - so it re-scans the same growing window
// every time. Mirrors the per-thread cap Gmail/Chat already apply.
const MAX_DOC_CHARS = 8000;

@Injectable()
export class DriveClient {
  constructor(private readonly auth: GoogleAuthService) {}

  /** Fetches "Next steps" sections from Google Docs (meeting notes) modified since `sinceIso`. */
  async fetchSince(sinceIso: string | null): Promise<RawSourceItem[]> {
    const authClient = await this.auth.getClient();
    const drive = google.drive({ version: "v3", auth: authClient });
    const docs = google.docs({ version: "v1", auth: authClient });
    const modifiedAfter = sinceIso ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const list = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.document' and modifiedTime > '${modifiedAfter}'`,
      fields: "files(id, name, webViewLink)",
      pageSize: 10,
    });
    const items: RawSourceItem[] = [];
    for (const file of list.data.files ?? []) {
      if (!file.id) continue;
      const doc = await docs.documents.get({ documentId: file.id });
      const text = (doc.data.body?.content ?? [])
        .flatMap((el) => el.paragraph?.elements ?? [])
        .map((el) => el.textRun?.content ?? "")
        .join("");
      if (!/next steps/i.test(text)) continue;
      items.push({
        rawText: `Doc: ${file.name}\n${text.slice(0, MAX_DOC_CHARS)}`,
        sourceUrl: file.webViewLink ?? `https://docs.google.com/document/d/${file.id}`,
        // A capped doc may drop an ask past the cut, so it must not count as a full read (FR-018).
        truncated: text.length > MAX_DOC_CHARS,
      });
    }
    return items;
  }
}
