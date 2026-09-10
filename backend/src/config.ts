/**
 * All non-secret-in-code configuration, read from the environment (populated from the single root
 * .env by src/load-env.ts). Previously split across backend/data/app-config.json and
 * backend/data/jira-credentials.json; now consolidated so there is one place to look.
 */
export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
  accountId: string;
}

export interface AppConfig {
  jiraBaseUrl: string;
  essUrl: string | null;
  /** Full JIRA credentials, or null when not all four values are set. */
  jira: JiraCredentials | null;
}

let cached: AppConfig | undefined;

export function getAppConfig(): AppConfig {
  if (cached) return cached;
  const baseUrl = process.env.JIRA_BASE_URL ?? "https://compareclub.atlassian.net";
  const email = process.env.JIRA_EMAIL ?? "";
  const apiToken = process.env.JIRA_API_TOKEN ?? "";
  const accountId = process.env.JIRA_ACCOUNT_ID ?? "";
  cached = {
    jiraBaseUrl: baseUrl,
    essUrl: process.env.ESS_URL || null,
    jira: email && apiToken && accountId ? { baseUrl, email, apiToken, accountId } : null,
  };
  return cached;
}
