import { useState } from "react";

interface Props {
  onAsk: (question: string) => void;
  isSearching: boolean;
  activeQuestion: string | null;
  resolvedQuery: string | null;
  onClear: () => void;
}

const SUGGESTIONS = [
  "¿Qué anunció OpenAI esta semana?",
  "Últimas rondas de inversión en startups de IA",
  "Novedades de Anthropic y Claude",
  "¿Qué está pasando con NVIDIA?",
];

export default function AskBar({ onAsk, isSearching, activeQuestion, resolvedQuery, onClear }: Props) {
  const [value, setValue] = useState("");

  const submit = (q: string) => {
    const question = q.trim();
    if (!question) return;
    setValue(question);
    onAsk(question);
  };

  return (
    <div className="border-b border-zinc-800 px-4 py-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 focus-within:border-sky-500"
      >
        <span className="text-lg" aria-hidden>
          ✨
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Preguntá algo y traigo las noticias en tiempo real..."
          className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-100 placeholder-zinc-500 outline-none"
        />
        <button
          type="submit"
          disabled={isSearching || !value.trim()}
          className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-40"
        >
          {isSearching ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {activeQuestion ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>
            Resultados en vivo para <span className="font-semibold text-zinc-200">“{activeQuestion}”</span>
            {resolvedQuery && resolvedQuery !== activeQuestion && (
              <>
                {" "}
                · query: <code className="text-sky-400">{resolvedQuery}</code>
              </>
            )}
          </span>
          <button
            onClick={() => {
              setValue("");
              onClear();
            }}
            className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
          >
            ✕ Volver al feed
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
