export type Category = "ai" | "startups" | "business" | "events" | "tech";

export interface CategoryMeta {
  id: Category;
  label: string;
  emoji: string;
}

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: Category;
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
