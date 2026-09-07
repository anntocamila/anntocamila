import { CATEGORIES } from "../data/categories";
import type { Category } from "../types";

interface Props {
  active: Category | "all" | null;
  onSelect: (c: Category | "all") => void;
  counts: Record<string, number>;
}

export default function Sidebar({ active, onSelect, counts }: Props) {
  const items: { id: Category | "all"; label: string; emoji: string }[] = [
    { id: "all", label: "Para ti", emoji: "🏠" },
    ...CATEGORIES,
  ];

  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="mb-3 flex items-center gap-2 px-2">
        <span className="text-2xl">📡</span>
        <span className="text-xl font-bold text-zinc-50">TechPulse</span>
      </div>

      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center justify-between gap-3 rounded-full px-4 py-2.5 text-left text-lg transition-colors ${
              isActive
                ? "bg-zinc-800 font-bold text-zinc-50"
                : "font-normal text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </span>
            {counts[item.id] > 0 && (
              <span className="text-xs font-medium text-zinc-500">{counts[item.id]}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
