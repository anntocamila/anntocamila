import type { FeedSource, Post } from "../types";
import { computeTags } from "./categorize";

const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";
const CORS_PROXY = "https://api.allorigins.win/raw?url=";
const FETCH_TIMEOUT_MS = 12_000;

/** fetch() with a hard timeout so one hung source never blocks the feed. */
async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImageFromHtml(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match?.[1];
}

/** Google News titles look like "Headline - Outlet Name". Split them so the
 *  outlet can be shown as "via Outlet" and the headline stays clean. */
function splitGoogleNewsTitle(title: string): { title: string; via?: string } {
  const idx = title.lastIndexOf(" - ");
  if (idx <= 0 || idx > title.length - 4) return { title };
  return { title: title.slice(0, idx).trim(), via: title.slice(idx + 3).trim() };
}

interface RawItem {
  title?: string;
  link?: string;
  guid?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  thumbnail?: string;
  enclosureUrl?: string;
  via?: string;
}

function toPost(source: FeedSource, raw: RawItem): Post | null {
  let title = raw.title?.trim();
  const link = raw.link?.trim();
  if (!title || !link) return null;

  let via = raw.via;
  if (source.url.startsWith("https://news.google.com/")) {
    const split = splitGoogleNewsTitle(title);
    title = split.title;
    via = via ?? split.via;
  }

  const rawDescription = raw.description || raw.content || "";
  let description = stripHtml(rawDescription).slice(0, 320);
  // Google News descriptions are just the headline again; drop the noise.
  if (description === title || description.startsWith(title)) description = "";

  const parsedDate = raw.pubDate ? new Date(raw.pubDate) : null;
  const pubDate =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date().toISOString();
  const imageUrl =
    raw.thumbnail || raw.enclosureUrl || firstImageFromHtml(rawDescription) || undefined;

  return {
    id: raw.guid || link,
    title,
    link,
    description,
    pubDate,
    source: via ? `${source.name} · via ${via}` : source.name,
    sourceCategory: source.category,
    tags: computeTags(title, description, source.category),
    imageUrl,
  };
}

async function fetchViaRss2Json(source: FeedSource): Promise<Post[]> {
  const url = `${RSS2JSON_ENDPOINT}${encodeURIComponent(source.url)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`rss2json HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok" || !Array.isArray(data.items)) {
    throw new Error(`rss2json bad response for ${source.id}`);
  }

  return (data.items as Array<Record<string, unknown>>)
    .map((item) =>
      toPost(source, {
        title: item.title as string,
        link: item.link as string,
        guid: item.guid as string,
        description: item.description as string,
        content: item.content as string,
        pubDate: item.pubDate as string,
        thumbnail: item.thumbnail as string,
        enclosureUrl: (item.enclosure as { link?: string } | undefined)?.link,
      }),
    )
    .filter((p): p is Post => p !== null);
}

function textOf(el: Element | null | undefined): string | undefined {
  return el?.textContent?.trim() || undefined;
}

export function parseXmlFeed(source: FeedSource, xmlText: string): Post[] {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error(`XML parse error for ${source.id}`);
  }

  const rssItems = Array.from(doc.querySelectorAll("item"));
  if (rssItems.length > 0) {
    return rssItems
      .map((item) => {
        const enclosure = item.querySelector("enclosure");
        const mediaThumb =
          item.getElementsByTagName("media:thumbnail")[0] ??
          item.getElementsByTagName("media:content")[0];
        return toPost(source, {
          title: textOf(item.querySelector("title")),
          link:
            textOf(item.querySelector("link")) ||
            item.querySelector("link")?.getAttribute("href") ||
            undefined,
          guid: textOf(item.querySelector("guid")),
          description: textOf(item.querySelector("description")),
          content: textOf(item.getElementsByTagName("content:encoded")[0]),
          pubDate:
            textOf(item.querySelector("pubDate")) ||
            textOf(item.getElementsByTagName("dc:date")[0]),
          thumbnail: mediaThumb?.getAttribute("url") || undefined,
          enclosureUrl: enclosure?.getAttribute("url") || undefined,
          via: textOf(item.querySelector("source")),
        });
      })
      .filter((p): p is Post => p !== null);
  }

  return Array.from(doc.querySelectorAll("entry"))
    .map((entry) => {
      const linkEl =
        entry.querySelector('link[rel="alternate"]') ||
        entry.querySelector("link[href]") ||
        entry.querySelector("link");
      return toPost(source, {
        title: textOf(entry.querySelector("title")),
        link: linkEl?.getAttribute("href") || textOf(linkEl),
        guid: textOf(entry.querySelector("id")),
        description: textOf(entry.querySelector("summary")),
        content: textOf(entry.querySelector("content")),
        pubDate:
          textOf(entry.querySelector("published")) || textOf(entry.querySelector("updated")),
      });
    })
    .filter((p): p is Post => p !== null);
}

async function fetchViaCorsProxy(source: FeedSource): Promise<Post[]> {
  const url = `${CORS_PROXY}${encodeURIComponent(source.url)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  return parseXmlFeed(source, await res.text());
}

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  story_text?: string;
  created_at: string;
  points?: number;
  num_comments?: number;
}

/** Hacker News' Algolia API sends CORS headers, so no proxy is needed. */
export async function fetchHackerNews(source: FeedSource): Promise<Post[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`HN HTTP ${res.status}`);
  const data = (await res.json()) as { hits: HnHit[] };

  return data.hits
    .map((hit) =>
      toPost(source, {
        title: hit.title,
        link: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        guid: `hn-${hit.objectID}`,
        description: `${hit.points ?? 0} puntos · ${hit.num_comments ?? 0} comentarios${
          hit.story_text ? ` · ${stripHtml(hit.story_text)}` : ""
        }`,
        pubDate: hit.created_at,
      }),
    )
    .filter((p): p is Post => p !== null);
}

export async function fetchFeed(source: FeedSource): Promise<Post[]> {
  if (source.kind === "hn-algolia") {
    try {
      return await fetchHackerNews(source);
    } catch (err) {
      console.warn(`Failed to load feed "${source.name}":`, err);
      return [];
    }
  }

  try {
    return await fetchViaRss2Json(source);
  } catch {
    try {
      return await fetchViaCorsProxy(source);
    } catch (err) {
      console.warn(`Failed to load feed "${source.name}":`, err);
      return [];
    }
  }
}

export function mergePosts(lists: Post[][]): Post[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((post) => {
      const key = post.link.replace(/[?#].*$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

export interface FetchAllResult {
  posts: Post[];
  failedSources: string[];
}

export interface FetchAllOptions {
  /** Called every time a source finishes, with everything loaded so far.
   *  Lets the UI render progressively instead of waiting for the slowest feed. */
  onPartial?: (posts: Post[], loaded: number, total: number) => void;
}

export async function fetchAllFeeds(
  sources: FeedSource[],
  options: FetchAllOptions = {},
): Promise<FetchAllResult> {
  const failedSources: string[] = [];
  const perSource: Post[][] = [];
  let loaded = 0;

  await Promise.all(
    sources.map(async (source) => {
      const posts = await fetchFeed(source);
      if (posts.length === 0) failedSources.push(source.name);
      perSource.push(posts);
      loaded += 1;
      options.onPartial?.(mergePosts(perSource), loaded, sources.length);
    }),
  );

  return { posts: mergePosts(perSource), failedSources };
}
