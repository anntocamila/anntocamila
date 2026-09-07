export type Category = "ai" | "labs" | "startups" | "business" | "events" | "tech";

export interface CategoryMeta {
  id: Category;
  label: string;
  emoji: string;
}

/** How a source is fetched.
 *  - "rss": an RSS/Atom feed (default).
 *  - "hn-algolia": Hacker News' public JSON search API (CORS enabled, no proxy). */
export type SourceKind = "rss" | "hn-algolia";

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: Category;
  kind?: SourceKind;
}

export interface Post {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  sourceCategory: Category;
  tags: Category[];
  imageUrl?: string;
}
