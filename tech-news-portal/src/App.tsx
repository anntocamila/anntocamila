import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FEED_SOURCES } from "./data/feeds";
import { fetchAllFeeds } from "./lib/rss";
import { liveSearch, rankResults } from "./lib/search";
import { loadCachedPosts, saveCachedPosts } from "./lib/cache";
import type { Category, Post } from "./types";
import Sidebar from "./components/Sidebar";
import MobileTabs from "./components/MobileTabs";
import Header, { headerLabel } from "./components/Header";
import AskBar from "./components/AskBar";
import Feed from "./components/Feed";
import RightPanel from "./components/RightPanel";

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 20;

interface LiveState {
  question: string;
  query: string | null;
  posts: Post[];
  isSearching: boolean;
  error: string | null;
}

export default function App() {
  const cached = useRef(loadCachedPosts()).current;

  const [posts, setPosts] = useState<Post[]>(cached?.posts ?? []);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.savedAt ?? null);

  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [live, setLive] = useState<LiveState | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress({ loaded: 0, total: FEED_SOURCES.length });
    try {
      const { posts: fetched, failedSources: failed } = await fetchAllFeeds(FEED_SOURCES, {
        onPartial: (partial, loaded, total) => {
          setProgress({ loaded, total });
          if (partial.length > 0) setPosts(partial);
        },
      });
      setFailedSources(failed);
      setLastUpdated(new Date());
      if (fetched.length === 0) {
        setError("Ninguna fuente respondió. Probá actualizar en unos minutos.");
      } else {
        setPosts(fetched);
        saveCachedPosts(fetched);
      }
    } catch {
      setError("Ocurrió un error inesperado al traer las noticias.");
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, query, live?.question]);

  const ask = useCallback(async (question: string) => {
    setLive({ question, query: null, posts: [], isSearching: true, error: null });
    try {
      const result = await liveSearch(question, {
        onPartial: (partial) =>
          setLive((prev) =>
            prev && prev.question === question ? { ...prev, posts: partial } : prev,
          ),
      });
      setLive((prev) =>
        prev && prev.question === question
          ? {
              ...prev,
              query: result.query,
              posts: rankResults(result.posts, result.query),
              isSearching: false,
              error:
                result.posts.length === 0
                  ? "No encontré noticias para esa pregunta. Probá con otras palabras."
                  : null,
            }
          : prev,
      );
    } catch {
      setLive((prev) =>
        prev && prev.question === question
          ? { ...prev, isSearching: false, error: "La búsqueda en vivo falló." }
          : prev,
      );
    }
  }, []);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = live ? live.posts : posts;
    return base.filter((post) => {
      const matchesCategory =
        live !== null || activeCategory === "all" || post.tags.includes(activeCategory);
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.description.toLowerCase().includes(q) ||
        post.source.toLowerCase().includes(q)
      );
    });
  }, [posts, live, activeCategory, query]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const post of posts) {
      for (const tag of post.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return counts;
  }, [posts]);

  const selectCategory = (c: Category | "all") => {
    setLive(null);
    setActiveCategory(c);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl text-zinc-100">
      <div className="hidden w-64 shrink-0 border-r border-zinc-800 lg:block">
        <div className="sticky top-0">
          <Sidebar active={live ? null : activeCategory} onSelect={selectCategory} counts={categoryCounts} />
        </div>
      </div>

      <main className="min-h-screen w-full max-w-2xl flex-1 border-r border-zinc-800">
        <MobileTabs active={live ? null : activeCategory} onSelect={selectCategory} />
        <Header
          activeLabel={live ? "Búsqueda en vivo" : headerLabel(activeCategory)}
          query={query}
          onQueryChange={setQuery}
          onRefresh={live ? () => ask(live.question) : load}
          isLoading={live ? live.isSearching : isLoading}
          lastUpdated={live ? null : lastUpdated}
          progress={progress}
        />
        <AskBar
          onAsk={ask}
          isSearching={live?.isSearching ?? false}
          activeQuestion={live?.question ?? null}
          resolvedQuery={live?.query ?? null}
          onClear={() => setLive(null)}
        />
        <Feed
          posts={filteredPosts}
          isLoading={live ? live.isSearching : isLoading}
          error={live ? live.error : error}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
        />
      </main>

      <RightPanel failedSources={failedSources} />
    </div>
  );
}
