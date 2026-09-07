import { CATEGORY_LABEL } from "../data/categories";
import type { Category } from "../types";

interface Props {
  activeLabel: string;
  query: string;
  onQueryChange: (q: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
}

export function headerLabel(active: Category | "all"): string {
  return active === "all" ? "Para ti" : CATEGORY_LABEL[active];
}

export default function Header({
  activeLabel,
  query,
  onQueryChange,
  onRefresh,
  isLoading,
  lastUpdated,
}: Props) {
  return (
    <div className="sticky top-0 z-10 border-b border-zinc-800 bg-black/85 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">{activeLabel}</h1>
          {lastUpdated && (
            <p className="text-xs text-zinc-500">
              Actualizado {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Actualizar"
          className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-50"
        >
          <span className={isLoading ? "inline-block animate-spin" : "inline-block"}>🔄</span>
        </button>
      </div>

      <div className="px-4 pb-3">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          type="search"
          placeholder="Buscar noticias, empresas, temas..."
          className="w-full rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-[15px] text-zinc-100 placeholder-zinc-500 outline-none focus:border-sky-500"
        />
      </div>
    </div>
  );
}
