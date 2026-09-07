import { CATEGORIES } from "../data/categories";
import type { Category } from "../types";

interface Props {
  active: Category | "all";
  onSelect: (c: Category | "all") => void;
}

export default function MobileTabs({ active, onSelect }: Props) {
  const items: { id: Category | "all"; label: string; emoji: string }[] = [
    { id: "all", label: "Para ti", emoji: "🏠" },
    ...CATEGORIES,
  ];

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 bg-black px-3 py-2 lg:hidden">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-50 text-black"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {item.emoji} {item.label}
          </button>
        );
      })}
    </div>
  );
}
