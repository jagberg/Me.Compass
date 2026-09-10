const BASE_URL = "/api";

export async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  // A long-running request (a big sync) must not pin the UI forever if it wedges. When timeoutMs is
  // given, abort the fetch after it; the backend keeps working, and live status polling reflects the
  // real per-source outcome regardless.
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller?.signal,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
