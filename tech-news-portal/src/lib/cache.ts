import type { Post } from "../types";

const KEY = "techpulse:posts:v2";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  savedAt: number;
  posts: Post[];
}

/** Last successful feed, so the app paints instantly on reload and then
 *  refreshes in the background (stale-while-revalidate). */
export function loadCachedPosts(): { posts: Post[]; savedAt: Date } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!Array.isArray(entry.posts) || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
    return { posts: entry.posts, savedAt: new Date(entry.savedAt) };
  } catch {
    return null;
  }
}

export function saveCachedPosts(posts: Post[]): void {
  try {
    const entry: CacheEntry = { savedAt: Date.now(), posts: posts.slice(0, 400) };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled: caching is best-effort.
  }
}
