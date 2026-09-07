import type { FeedSource, Post } from "../types";
import { computeTags } from "./categorize";

const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImageFromHtml(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match?.[1];
}

function toPost(
  source: FeedSource,
  raw: {
    title?: string;
    link?: string;
    guid?: string;
    description?: string;
    content?: string;
    pubDate?: string;
    thumbnail?: string;
    enclosureUrl?: string;
  },
): Post | null {
  const title = raw.title?.trim();
  const link = raw.link?.trim();
  if (!title || !link) return null;

  const rawDescription = raw.description || raw.content || "";
  const description = stripHtml(rawDescription).slice(0, 320);
  const pubDate = raw.pubDate ? new Date(raw.pubDate).toISOString() : new Date().toISOString();
  const imageUrl =
    raw.thumbnail || raw.enclosureUrl || firstImageFromHtml(rawDescription) || undefined;

  return {
    id: raw.guid || link,
    title,
    link,
    description,
    pubDate,
    source: source.name,
    sourceCategory: source.category,
    tags: computeTags(title, description, source.category),
    imageUrl,
  };
}

async function fetchViaRss2Json(source: FeedSource): Promise<Post[]> {
  const url = `${RSS2JSON_ENDPOINT}${encodeURIComponent(source.url)}`;
  const res = await fetch(url);
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

async function fetchViaCorsProxy(source: FeedSource): Promise<Post[]> {
  const url = `${CORS_PROXY}${encodeURIComponent(source.url)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const xmlText = await res.text();
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error(`XML parse error for ${source.id}`);
  }

  const rssItems = Array.from(doc.querySelectorAll("item"));
  const atomEntries = Array.from(doc.querySelectorAll("entry"));

  if (rssItems.length > 0) {
    return rssItems
      .map((item) => {
        const enclosure = item.querySelector("enclosure");
        const mediaThumb = item.getElementsByTagName("media:thumbnail")[0];
        return toPost(source, {
          title: textOf(item.querySelector("title")),
          link: textOf(item.querySelector("link")) || item.querySelector("link")?.getAttribute("href") || undefined,
          guid: textOf(item.querySelector("guid")),
          description: textOf(item.querySelector("description")),
          content: textOf(item.getElementsByTagName("content:encoded")[0]),
          pubDate: textOf(item.querySelector("pubDate")) || textOf(item.querySelector("date")),
          thumbnail: mediaThumb?.getAttribute("url") || undefined,
          enclosureUrl: enclosure?.getAttribute("url") || undefined,
        });
      })
      .filter((p): p is Post => p !== null);
  }

  return atomEntries
    .map((entry) => {
      const linkEl = entry.querySelector("link[href]") || entry.querySelector("link");
      return toPost(source, {
        title: textOf(entry.querySelector("title")),
        link: linkEl?.getAttribute("href") || textOf(linkEl),
        guid: textOf(entry.querySelector("id")),
        description: textOf(entry.querySelector("summary")),
        content: textOf(entry.querySelector("content")),
        pubDate: textOf(entry.querySelector("published")) || textOf(entry.querySelector("updated")),
      });
    })
    .filter((p): p is Post => p !== null);
}

export async function fetchFeed(source: FeedSource): Promise<Post[]> {
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

export interface FetchAllResult {
  posts: Post[];
  failedSources: string[];
}

export async function fetchAllFeeds(sources: FeedSource[]): Promise<FetchAllResult> {
  const failedSources: string[] = [];

  const results = await Promise.all(
    sources.map(async (source) => {
      const posts = await fetchFeed(source);
      if (posts.length === 0) failedSources.push(source.name);
      return posts;
    }),
  );

  const seen = new Set<string>();
  const posts = results
    .flat()
    .filter((post) => {
      if (seen.has(post.link)) return false;
      seen.add(post.link);
      return true;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return { posts, failedSources };
}
