"use client";

import { StockQuote } from "@/types/stock";
import { TrendingUp, TrendingDown, Minus, X } from "lucide-react";

interface Props {
  quote: StockQuote;
  cost?: number;
  shares?: number;
  onRemove: () => void;
  onClick: () => void;
  selected?: boolean;
}

export default function StockCard({ quote, cost, shares, onRemove, onClick, selected }: Props) {
  const isUp = quote.change > 0;
  const isDown = quote.change < 0;
  const color = isUp ? "text-red-400" : isDown ? "text-green-400" : "text-gray-400";
  const bgSelected = selected ? "ring-2 ring-blue-500" : "";
  const pnl = cost && shares ? (quote.price - cost) * shares : null;
  const pnlPct = cost ? ((quote.price - cost) / cost) * 100 : null;
  const isLimitUp = quote.price >= quote.limitUp;
  const isLimitDown = quote.price <= quote.limitDown;

  return (
    <div
      className={`relative bg-[#1a1d2e] rounded-xl p-4 cursor-pointer hover:bg-[#1e2235] transition-all ${bgSelected}`}
      onClick={onClick}
    >
      <button
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-400"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <X size={14} />
      </button>

      <div className="flex items-start justify-between mb-2 pr-4">
        <div>
          <div className="text-xs text-gray-500">{quote.symbol}</div>
          <div className="font-semibold text-white text-sm">{quote.name}</div>
        </div>
        {isLimitUp && <span className="text-xs bg-red-500 text-white px-1 rounded">漲停</span>}
        {isLimitDown && <span className="text-xs bg-green-600 text-white px-1 rounded">跌停</span>}
      </div>

      <div className={`text-2xl font-bold ${color}`}>
        {quote.price > 0 ? quote.price.toFixed(2) : "—"}
      </div>

      <div className={`flex items-center gap-1 text-sm ${color}`}>
        {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
        <span>{quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)}</span>
        <span>({quote.changePercent > 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)</span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-gray-500">
        <div>開 {quote.open > 0 ? quote.open.toFixed(1) : "—"}</div>
        <div>高 <span className="text-red-400">{quote.high > 0 ? quote.high.toFixed(1) : "—"}</span></div>
        <div>低 <span className="text-green-400">{quote.low > 0 ? quote.low.toFixed(1) : "—"}</span></div>
      </div>

      {pnl !== null && pnlPct !== null && (
        <div className={`mt-2 pt-2 border-t border-gray-800 text-xs ${pnl >= 0 ? "text-red-400" : "text-green-400"}`}>
          損益 {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)} 元
          <span className="ml-1">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
        </div>
      )}
    </div>
  );
}
