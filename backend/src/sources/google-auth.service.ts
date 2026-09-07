import { Injectable, Logger } from "@nestjs/common";
import { google, Auth } from "googleapis";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const TOKEN_PATH = process.env.DATA_DIR ? `${process.env.DATA_DIR}/google-tokens.json` : "./data/google-tokens.json";
const LOOPBACK_PORT = 51789;
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
];

/** Shared OAuth for Gmail/Drive/Chat: one installed-app client, one token file, all three scopes at once. */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private client: Auth.OAuth2Client | undefined;

  private newClient(): Auth.OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `http://127.0.0.1:${LOOPBACK_PORT}`,
    );
  }

  private loadTokens(): Auth.Credentials | undefined {
    if (!existsSync(TOKEN_PATH)) return undefined;
    return JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  }

  private saveTokens(tokens: Auth.Credentials): void {
    mkdirSync(dirname(TOKEN_PATH), { recursive: true });
    writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  }

  private async connect(): Promise<Auth.OAuth2Client> {
    const client = this.newClient();
    const authUrl = client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });
    this.logger.warn(`Google not connected. Open this URL to authorize:\n${authUrl}`);

    const code = await new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "", `http://127.0.0.1:${LOOPBACK_PORT}`);
        const code = url.searchParams.get("code");
        res.end(code ? "Authorized — you can close this tab." : "Missing code.");
        server.close();
        code ? resolve(code) : reject(new Error("OAuth callback missing code"));
      });
      server.listen(LOOPBACK_PORT);
    });

    const { tokens } = await client.getToken(code);
    this.saveTokens(tokens);
    client.setCredentials(tokens);
    return client;
  }

  /** Returns an authenticated client, refreshing stored tokens or running the connect flow if needed. */
  async getClient(): Promise<Auth.OAuth2Client> {
    if (this.client) return this.client;
    const stored = this.loadTokens();
    if (stored) {
      const client = this.newClient();
      client.setCredentials(stored);
      client.on("tokens", (tokens) => this.saveTokens({ ...stored, ...tokens }));
      this.client = client;
      return client;
    }
    this.client = await this.connect();
    return this.client;
  }

  isConnected(): boolean {
    return existsSync(TOKEN_PATH);
  }
}
