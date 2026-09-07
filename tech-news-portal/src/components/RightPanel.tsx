import { FEED_SOURCES } from "../data/feeds";
import { CATEGORY_LABEL } from "../data/categories";

export default function RightPanel({ failedSources }: { failedSources: string[] }) {
  return (
    <div className="hidden w-80 shrink-0 flex-col gap-4 p-4 xl:flex">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="mb-3 text-lg font-bold text-zinc-50">Fuentes</h2>
        <ul className="flex flex-col gap-2">
          {FEED_SOURCES.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">{s.name}</span>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                {CATEGORY_LABEL[s.category]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {failedSources.length > 0 && (
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-400">
          <p className="font-semibold">Sin datos por ahora:</p>
          <p className="mt-1 text-amber-500/80">{failedSources.join(", ")}</p>
        </div>
      )}

      <p className="px-1 text-xs text-zinc-600">
        TechPulse agrega titulares de RSS públicos de IA, startups, negocios, eventos y tecnología.
        No almacena datos personales.
      </p>
    </div>
  );
}
