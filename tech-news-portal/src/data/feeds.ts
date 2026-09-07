import type { FeedSource } from "../types";

/** Google News exposes a public RSS endpoint for any search query. It is the
 *  most reliable way to follow companies that don't publish their own feed
 *  (Anthropic, Mistral, xAI...) and it aggregates hundreds of outlets. */
export function googleNewsSearchUrl(query: string, lang: "en" | "es" = "en"): string {
  const locale = lang === "es" ? "hl=es-419&gl=AR&ceid=AR:es-419" : "hl=en-US&gl=US&ceid=US:en";
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;
}

// Curated public feeds. Every feed is free and requires no API key.
export const FEED_SOURCES: FeedSource[] = [
  // --- Labs de IA (las empresas que hacen los modelos) ---
  {
    id: "openai",
    name: "OpenAI",
    url: "https://openai.com/news/rss.xml",
    category: "labs",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    url: googleNewsSearchUrl('"Anthropic" AND (Claude OR model OR AI)'),
    category: "labs",
  },
  {
    id: "deepmind",
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    category: "labs",
  },
  {
    id: "googleai",
    name: "Google AI",
    url: "https://blog.google/technology/ai/rss/",
    category: "labs",
  },
  {
    id: "meta-ai",
    name: "Meta AI",
    url: "https://ai.meta.com/blog/rss/",
    category: "labs",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    url: googleNewsSearchUrl('"Mistral AI"'),
    category: "labs",
  },
  {
    id: "xai",
    name: "xAI",
    url: googleNewsSearchUrl('"xAI" AND Grok'),
    category: "labs",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
    category: "labs",
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    url: "https://blogs.nvidia.com/feed/",
    category: "labs",
  },
  {
    id: "microsoft-ai",
    name: "Microsoft AI",
    url: "https://blogs.microsoft.com/ai/feed/",
    category: "labs",
  },

  // --- Inteligencia artificial (medios) ---
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
    id: "theverge-ai",
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    category: "ai",
  },
  {
    id: "google-news-ai",
    name: "Google News · IA",
    url: googleNewsSearchUrl("artificial intelligence"),
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
  {
    id: "ycombinator",
    name: "Y Combinator Blog",
    url: "https://www.ycombinator.com/blog/rss/",
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
  {
    id: "google-news-tech-es",
    name: "Google News · Tecnología (ES)",
    url: googleNewsSearchUrl("tecnología startups inteligencia artificial", "es"),
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
    id: "google-news-events",
    name: "Google News · Eventos tech",
    url: googleNewsSearchUrl("(tech OR AI) AND (conference OR summit OR keynote OR hackathon)"),
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
    url: "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30",
    category: "tech",
    kind: "hn-algolia",
  },
];
