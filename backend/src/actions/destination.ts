import { Action, SourceType } from "../types";
import { getAppConfig } from "../config";

export interface Destination {
  action_url: string;
  action_target: string;
}

const SOURCE_LABEL: Record<SourceType, string> = { email: "Email", chat: "Chat", meeting: "Doc", manual: "" };

/**
 * Where the user goes to ACTION this item (for the play button), which is not always where it was
 * extracted from. Order: a JIRA ticket it names -> the ticket; a leave/HR ask -> ESS (if configured);
 * otherwise the originating source (chat thread / email / doc). Returns null when there's nowhere to go.
 */
export function resolveDestination(a: Action): Destination | null {
  const cfg = getAppConfig();
  const text = `${a.title} ${a.description}`;

  // A hyphenated project key like CM-391 -> the JIRA ticket.
  const jira = text.match(/\b([A-Z]{2,}-\d+)\b/);
  if (jira) return { action_url: `${cfg.jiraBaseUrl}/browse/${jira[1]}`, action_target: "JIRA" };

  // A leave/HR approval -> ESS (only if its URL is configured; else fall through to the source).
  if (/\bleave\b/i.test(a.title) && cfg.essUrl) return { action_url: cfg.essUrl, action_target: "ESS" };

  // Otherwise open where it came from.
  if (a.source_url) return { action_url: a.source_url, action_target: SOURCE_LABEL[a.source_type] };

  return null;
}

/**
 * Pins a chat.google.com link to the reader's account with ?authuser=<email>. Without it the link
 * resolves against the browser's default Google account and, if that isn't the reader, Chat drops
 * them on its home page instead of the thread. Non-chat URLs and already-pinned links pass through.
 */
function pinChatAccount(url: string | null): string | null {
  const email = getAppConfig().meEmail;
  if (!url || !email) return url;
  if (!url.startsWith("https://chat.google.com/") || url.includes("authuser=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}authuser=${email}`;
}

/** Attaches action_url/action_target to an action for API responses. */
export function withDestination(a: Action): Action {
  // Pin chat source_urls before resolving, so both the source icon (source_url) and the play button
  // (action_url, derived from source_url) open in the reader's account.
  const pinned = a.source_type === "chat" ? { ...a, source_url: pinChatAccount(a.source_url) } : a;
  const dest = resolveDestination(pinned);
  return dest ? { ...pinned, ...dest } : pinned;
}
