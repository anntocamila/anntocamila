import type { Post } from "../types";
import { CATEGORY_LABEL } from "../data/categories";
import { timeAgo } from "../lib/time";
import SourceAvatar from "./SourceAvatar";

export default function PostCard({ post }: { post: Post }) {
  const [sourceName, via] = post.source.split(" · via ");
  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 border-b border-zinc-800 px-4 py-3 transition-colors hover:bg-zinc-950"
    >
      <SourceAvatar name={sourceName} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 text-[15px]">
          <span className="font-bold text-zinc-100">{sourceName}</span>
          {via && <span className="text-zinc-500">via {via}</span>}
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">{timeAgo(post.pubDate)}</span>
          <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
            {CATEGORY_LABEL[post.sourceCategory]}
          </span>
        </div>

        <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-semibold text-zinc-50">
          {post.title}
        </p>

        {post.description && (
          <p className="line-clamp-3 mt-1 break-words text-[15px] text-zinc-400">
            {post.description}
          </p>
        )}

        {post.imageUrl && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800">
            <img
              src={post.imageUrl}
              alt=""
              loading="lazy"
              className="max-h-80 w-full object-cover"
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </a>
  );
}
