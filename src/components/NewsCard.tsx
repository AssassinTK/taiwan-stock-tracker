"use client";

import { NewsItem } from "@/types/stock";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ExternalLink } from "lucide-react";

const SECTOR_COLORS: Record<string, string> = {
  "AI/半導體": "bg-purple-900 text-purple-300",
  "匯率/美元": "bg-yellow-900 text-yellow-300",
  "航運/油價": "bg-blue-900 text-blue-300",
  "銀行/金融": "bg-emerald-900 text-emerald-300",
  "地緣政治": "bg-red-900 text-red-300",
  "科技/電子": "bg-cyan-900 text-cyan-300",
};

interface Props {
  news: NewsItem;
  watchlistSectors: string[];
}

export default function NewsCard({ news, watchlistSectors }: Props) {
  const hasImpact = news.sectors.some((s) => watchlistSectors.includes(s));
  const timeAgo = formatDistanceToNow(new Date(news.publishedAt), {
    addSuffix: true,
    locale: zhTW,
  });

  return (
    <div className={`bg-[#1a1d2e] rounded-xl p-4 border ${hasImpact ? "border-yellow-800" : "border-transparent"}`}>
      {hasImpact && (
        <div className="text-xs text-yellow-500 mb-1 font-medium">⚡ 影響你的自選股</div>
      )}
      <a
        href={news.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-white hover:text-blue-400 transition-colors flex items-start gap-1 group"
      >
        <span className="flex-1 leading-snug">{news.title}</span>
        <ExternalLink size={12} className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
      </a>

      {news.summary && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{news.summary}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-xs text-gray-600">{news.source} · {timeAgo}</span>
        {news.sectors.map((s) => (
          <span key={s} className={`text-xs px-1.5 py-0.5 rounded ${SECTOR_COLORS[s] ?? "bg-gray-800 text-gray-400"}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
