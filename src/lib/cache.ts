// Simple local cache for P2P-style fallback when feed fails to load
const KEY = "decentra:feed-cache";
export function cacheFeed(items: unknown[]) {
  try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), items })); } catch { /* ignore */ }
}
export function getCachedFeed<T = unknown>(): T[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw).items as T[];
  } catch { return []; }
}
