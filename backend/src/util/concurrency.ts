/**
 * Runs `fn` over `items` with at most `limit` in flight at once, returning results in input order.
 * Used to parallelise the per-item `claude` extraction calls (each is a slow subprocess) without
 * spawning one process per item at once. A rejection propagates (first error wins), matching the
 * previous sequential loop's "one failure fails the source" behaviour.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, worker);
  await Promise.all(workers);
  return results;
}
