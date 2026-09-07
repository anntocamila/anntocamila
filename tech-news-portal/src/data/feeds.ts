import type { FeedSource } from "../types";

// Curated public RSS feeds. Every feed is free and requires no API key.
export const FEED_SOURCES: FeedSource[] = [
  // --- Inteligencia artificial ---
  {
    id: "artificialintelligence-news",
    name: "AI News",
    url: "https://www.artificialintelligence-news.com/feed/",
    category: "ai",
  },
  {
    id: "venturebeat-ai",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    category: "ai",
  },
  {
    id: "marktechpost",
    name: "MarkTechPost",
    url: "https://www.marktechpost.com/feed/",
    category: "ai",
  },
  {
    id: "technologyreview",
    name: "MIT Technology Review",
    url: "https://www.technologyreview.com/feed/",
    category: "ai",
  },
  {
    id: "googleai",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    category: "ai",
  },

  // --- Startups ---
  {
    id: "techcrunch-startups",
    name: "TechCrunch Startups",
    url: "https://techcrunch.com/category/startups/feed/",
    category: "startups",
  },
  {
    id: "crunchbase-news",
    name: "Crunchbase News",
    url: "https://news.crunchbase.com/feed/",
    category: "startups",
  },
  {
    id: "producthunt",
    name: "Product Hunt",
    url: "https://www.producthunt.com/feed",
    category: "startups",
  },
  {
    id: "techcrunch-venture",
    name: "TechCrunch Venture",
    url: "https://techcrunch.com/category/venture/feed/",
    category: "startups",
  },

  // --- Negocios / empresas ---
  {
    id: "techcrunch",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    category: "business",
  },
  {
    id: "fastcompany-tech",
    name: "Fast Company Tech",
    url: "https://www.fastcompany.com/technology/rss",
    category: "business",
  },
  {
    id: "venturebeat",
    name: "VentureBeat",
    url: "https://venturebeat.com/feed/",
    category: "business",
  },
  {
    id: "businessinsider-tech",
    name: "Business Insider Tech",
    url: "https://www.businessinsider.com/tech/rss",
    category: "business",
  },

  // --- Eventos ---
  {
    id: "techcrunch-events",
    name: "TechCrunch Events",
    url: "https://techcrunch.com/tag/events/feed/",
    category: "events",
  },
  {
    id: "eventbrite-tech",
    name: "Meetup Tech Events",
    url: "https://www.meetup.com/topics/tech/rss/",
    category: "events",
  },

  // --- Tech general ---
  {
    id: "theverge",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    category: "tech",
  },
  {
    id: "arstechnica",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "tech",
  },
  {
    id: "wired",
    name: "Wired",
    url: "https://www.wired.com/feed/rss",
    category: "tech",
  },
  {
    id: "engadget",
    name: "Engadget",
    url: "https://www.engadget.com/rss.xml",
    category: "tech",
  },
  {
    id: "hackernews",
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    category: "tech",
  },
];
