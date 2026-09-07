import { useCallback, useEffect, useMemo, useState } from "react";
import { FEED_SOURCES } from "./data/feeds";
import { fetchAllFeeds } from "./lib/rss";
import type { Category, Post } from "./types";
import Sidebar from "./components/Sidebar";
import MobileTabs from "./components/MobileTabs";
import Header, { headerLabel } from "./components/Header";
import Feed from "./components/Feed";
import RightPanel from "./components/RightPanel";

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 20;

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { posts: fetched, failedSources: failed } = await fetchAllFeeds(FEED_SOURCES);
      setPosts(fetched);
      setFailedSources(failed);
      setLastUpdated(new Date());
      if (fetched.length === 0) {
        setError("Ninguna fuente respondió. Probá actualizar en unos minutos.");
      }
    } catch {
      setError("Ocurrió un error inesperado al traer las noticias.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, query]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesCategory = activeCategory === "all" || post.tags.includes(activeCategory);
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.description.toLowerCase().includes(q) ||
        post.source.toLowerCase().includes(q)
      );
    });
  }, [posts, activeCategory, query]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const post of posts) {
      for (const tag of post.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return counts;
  }, [posts]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl text-zinc-100">
      <div className="hidden w-64 shrink-0 border-r border-zinc-800 lg:block">
        <div className="sticky top-0">
          <Sidebar active={activeCategory} onSelect={setActiveCategory} counts={categoryCounts} />
        </div>
      </div>

      <main className="min-h-screen w-full max-w-2xl flex-1 border-r border-zinc-800">
        <MobileTabs active={activeCategory} onSelect={setActiveCategory} />
        <Header
          activeLabel={headerLabel(activeCategory)}
          query={query}
          onQueryChange={setQuery}
          onRefresh={load}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
        />
        <Feed
          posts={filteredPosts}
          isLoading={isLoading}
          error={error}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
        />
      </main>

      <RightPanel failedSources={failedSources} />
    </div>
  );
}
