import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Small app config for things that vary by environment but aren't secrets-in-code: the JIRA base
 * URL and the ESS (leave/HR) base URL used to build action deep-links. Read from data/app-config.json
 * (gitignored) with env overrides. Missing values fall back to sensible defaults / no link.
 */
export interface AppConfig {
  jiraBaseUrl: string;
  essUrl: string | null;
}

const CONFIG_PATH = process.env.DATA_DIR ? `${process.env.DATA_DIR}/app-config.json` : "./data/app-config.json";

let cached: AppConfig | undefined;

export function getAppConfig(): AppConfig {
  if (cached) return cached;
  let file: { jira_base_url?: string; ess_url?: string } = {};
  try {
    const path = join(process.cwd(), CONFIG_PATH);
    if (existsSync(path)) file = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    /* ignore malformed config; use defaults */
  }
  cached = {
    jiraBaseUrl: process.env.JIRA_BASE_URL ?? file.jira_base_url ?? "https://compareclub.atlassian.net",
    essUrl: process.env.ESS_URL ?? file.ess_url ?? null,
  };
  return cached;
}
