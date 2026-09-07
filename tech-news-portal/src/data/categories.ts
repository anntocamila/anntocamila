import type { CategoryMeta } from "../types";

export const CATEGORIES: CategoryMeta[] = [
  { id: "ai", label: "IA", emoji: "🤖" },
  { id: "labs", label: "Labs IA", emoji: "🧪" },
  { id: "startups", label: "Startups", emoji: "🚀" },
  { id: "business", label: "Negocios", emoji: "💼" },
  { id: "events", label: "Eventos", emoji: "📅" },
  { id: "tech", label: "Tech", emoji: "💻" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);
