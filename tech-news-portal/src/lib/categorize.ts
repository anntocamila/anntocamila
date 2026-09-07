import type { Category } from "../types";

const KEYWORDS: Record<Category, string[]> = {
  ai: [
    "ai ",
    " ai",
    "artificial intelligence",
    "machine learning",
    "llm",
    "chatgpt",
    "openai",
    "gpt-",
    "gemini",
    "claude",
    "anthropic",
    "generative",
    "neural network",
    "inteligencia artificial",
  ],
  labs: [
    "openai",
    "anthropic",
    "deepmind",
    "google ai",
    "gemini",
    "meta ai",
    "llama",
    "mistral",
    "xai",
    "grok",
    "hugging face",
    "nvidia",
    "claude",
    "gpt-",
    "chatgpt",
    "sora",
    "foundation model",
    "frontier model",
  ],
  startups: [
    "startup",
    "founder",
    "seed round",
    "series a",
    "series b",
    "venture capital",
    "vc ",
    "y combinator",
    "pitch deck",
    "unicorn",
    "emprendimiento",
  ],
  business: [
    "funding",
    "acquisition",
    "acquires",
    "ipo",
    "revenue",
    "valuation",
    "merger",
    "ceo",
    "earnings",
    "layoffs",
    "empresa",
    "negocio",
  ],
  events: [
    "conference",
    "summit",
    "keynote",
    "expo",
    "hackathon",
    "meetup",
    "webinar",
    "livestream",
    "evento",
  ],
  tech: [
    "app",
    "software",
    "hardware",
    "gadget",
    "chip",
    "smartphone",
    "device",
    "tecnología",
  ],
};

/** Derives extra category tags from the post title/description so a single
 * item can surface under more than one filter (e.g. an "AI startup raises
 * funding" article matches both "ai" and "startups"). */
export function computeTags(
  title: string,
  description: string,
  sourceCategory: Category,
): Category[] {
  const text = ` ${title.toLowerCase()} ${description.toLowerCase()} `;
  const tags = new Set<Category>([sourceCategory]);

  for (const [category, keywords] of Object.entries(KEYWORDS) as [
    Category,
    string[],
  ][]) {
    if (keywords.some((kw) => text.includes(kw))) {
      tags.add(category);
    }
  }

  return Array.from(tags);
}
