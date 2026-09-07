import type { Post } from "../types";
import PostCard from "./PostCard";

interface Props {
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  visibleCount: number;
  onLoadMore: () => void;
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse gap-3 border-b border-zinc-800 px-4 py-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-800" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-zinc-800" />
        <div className="h-4 w-4/5 rounded bg-zinc-800" />
        <div className="h-3 w-2/3 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export default function Feed({ posts, isLoading, error, visibleCount, onLoadMore }: Props) {
  if (isLoading && posts.length === 0) {
    return (
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-zinc-400">
        <p className="text-lg font-semibold text-zinc-200">No pudimos cargar las noticias</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-zinc-400">
        <p className="text-lg font-semibold text-zinc-200">Sin resultados</p>
        <p className="mt-1 text-sm">Probá con otra categoría o término de búsqueda.</p>
      </div>
    );
  }

  const visible = posts.slice(0, visibleCount);

  return (
    <div>
      {visible.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {visibleCount < posts.length ? (
        <button
          onClick={onLoadMore}
          className="w-full py-4 text-center text-sm font-semibold text-sky-500 transition-colors hover:bg-zinc-950"
        >
          Cargar más
        </button>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-600">Estás al día ✨</p>
      )}
    </div>
  );
}
