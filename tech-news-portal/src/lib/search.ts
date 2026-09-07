import type { FeedSource, Post } from "../types";
import { googleNewsSearchUrl } from "../data/feeds";
import { fetchAllFeeds, type FetchAllOptions, type FetchAllResult } from "./rss";

/** Words that carry no search intent, in Spanish and English. The
 *  "orchestrator" turns a natural-language question into a keyword query
 *  that the live news sources understand. */
const STOPWORDS = new Set([
  // es
  "que", "qué", "cual", "cuál", "cuales", "cuáles", "como", "cómo", "cuando", "cuándo", "donde", "dónde",
  "quien", "quién", "por", "para", "con", "sin", "sobre", "de", "del", "la", "las", "el", "los", "un",
  "una", "unos", "unas", "y", "o", "en", "a", "al", "es", "son", "hay", "está", "esta", "están", "estan",
  "fue", "ser", "hace", "hizo", "pasa", "pasó", "paso", "pasando", "nuevo", "nueva", "nuevas", "nuevos",
  "ultimo", "último", "ultimas", "últimas", "ultimos", "últimos", "noticias", "noticia", "novedades",
  "hoy", "ayer", "semana", "mes", "año", "me", "te", "se", "lo", "le", "su", "sus", "mi", "tu", "ya",
  "muy", "mas", "más", "pero", "si", "sí", "no", "algo", "todo", "contame", "decime", "mostrame",
  "buscame", "busca", "quiero", "saber", "hablar", "dime", "cuentame", "cuéntame",
  // en
  "what", "which", "who", "how", "when", "where", "why", "is", "are", "was", "were", "the", "a", "an",
  "of", "in", "on", "at", "to", "for", "with", "about", "and", "or", "news", "latest", "new", "recent",
  "today", "this", "week", "month", "year", "tell", "me", "show", "find", "search", "happening",
  "going", "did", "does", "do", "has", "have", "any", "there", "some", "up", "it", "its",
]);

export function questionToQuery(question: string): string {
  const terms = question
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'()[\]]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  const unique = Array.from(new Set(terms)).slice(0, 6);
  return unique.length > 0 ? unique.join(" ") : question.trim();
}

/** Live sources that accept an arbitrary query. */
export function liveSourcesFor(query: string): FeedSource[] {
  const q = encodeURIComponent(query);
  return [
    {
      id: "live-google-en",
      name: "Google News",
      url: googleNewsSearchUrl(query, "en"),
      category: "tech",
    },
    {
      id: "live-google-es",
      name: "Google News (ES)",
      url: googleNewsSearchUrl(query, "es"),
      category: "tech",
    },
    {
      id: "live-bing",
      name: "Bing News",
      url: `https://www.bing.com/news/search?q=${q}&format=rss`,
      category: "tech",
    },
    {
      id: "live-hn",
      name: "Hacker News",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=story&hitsPerPage=25`,
      category: "tech",
      kind: "hn-algolia",
    },
  ];
}

export interface LiveSearchResult extends FetchAllResult {
  query: string;
}

/** Fan a question out to every live source in parallel and merge the answers. */
export async function liveSearch(
  question: string,
  options: FetchAllOptions = {},
): Promise<LiveSearchResult> {
  const query = questionToQuery(question);
  const result = await fetchAllFeeds(liveSourcesFor(query), options);
  return { ...result, query };
}

/** Rank live results: newest first, but boost posts that mention more of the
 *  query terms in the title so the most relevant land on top. */
export function rankResults(posts: Post[], query: string): Post[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (p: Post) => {
    const title = p.title.toLowerCase();
    const hits = terms.filter((t) => title.includes(t)).length;
    const ageHours = (Date.now() - new Date(p.pubDate).getTime()) / 36e5;
    return hits * 24 - ageHours; // one matching term is worth a day of freshness
  };
  return [...posts].sort((a, b) => score(b) - score(a));
}
