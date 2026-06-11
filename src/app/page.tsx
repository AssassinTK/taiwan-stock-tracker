"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Bell, RefreshCw, TrendingUp, Globe, Loader2, X, Search, BarChart2, Layers, Activity, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import TradingViewChart from "@/components/TradingViewChart";
import NewsCard from "@/components/NewsCard";
import { StockQuote, WatchlistItem, NewsItem } from "@/types/stock";

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "2330", name: "台積電" },
  { symbol: "2317", name: "鴻海" },
  { symbol: "0050", name: "元大台灣50" },
];

type Tab = "庫存股" | "K線圖" | "新聞";
type BottomNav = "庫存股" | "自選股" | "選股" | "大盤" | "動向" | "K線";
type SortKey = "name" | "todayPnl" | "change" | "totalPnl";
interface MarketItem { label: string; symbol: string; price: string; change: string; pct: string; up: boolean | null; }
interface SectorItem { name: string; pct: string; up?: boolean; }

function useLocalStorage<T>(key: string, init: T) {
  const [val, setVal] = useState<T>(init);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setVal(JSON.parse(s)); } catch { /**/ }
  }, [key]);
  const set = useCallback((v: T | ((p: T) => T)) => {
    setVal((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [val, set] as const;
}

function fmtNum(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (abs >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString();
}
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }
function numColor(n: number) { return n > 0 ? "#e74c3c" : n < 0 ? "#2ecc71" : "#888"; }

// 實心扇形圓餅圖
function PieChart({ profitPct }: { profitPct: number }) {
  const cx = 44, cy = 44, r = 38;
  const p = Math.max(0, Math.min(100, profitPct));
  if (p <= 0) return <svg width="88" height="88"><circle cx={cx} cy={cy} r={r} fill="#2ecc71" /></svg>;
  if (p >= 100) return <svg width="88" height="88"><circle cx={cx} cy={cy} r={r} fill="#e74c3c" /></svg>;
  const angle = (p / 100) * 2 * Math.PI;
  const ex = cx + r * Math.sin(angle);
  const ey = cy - r * Math.cos(angle);
  const large = p > 50 ? 1 : 0;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx={cx} cy={cy} r={r} fill="#2ecc71" />
      <path d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${large},1 ${ex},${ey} Z`} fill="#e74c3c" />
    </svg>
  );
}

export default function Home() {
  const [watchlist, setWatchlist] = useLocalStorage<WatchlistItem[]>("watchlist", DEFAULT_WATCHLIST);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("庫存股");
  const [activeBottom, setActiveBottom] = useState<BottomNav>("庫存股");
  const [selectedSymbol, setSelectedSymbol] = useState("2330");
  const [marketIndex, setMarketIndex] = useState<{ name: string; value: string; change: string; pct: string; up: boolean }[]>([]);
  const [marketTab, setMarketTab] = useState<"台灣指數" | "美股行情" | "產業即時">("台灣指數");
  const [usMarket, setUsMarket] = useState<{ futures: MarketItem[]; indices: MarketItem[] } | null>(null);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [sectorSort, setSectorSort] = useState<"漲幅" | "跌幅">("漲幅");
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addName, setAddName] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addShares, setAddShares] = useState("");
  const [notifying, setNotifying] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("todayPnl");
  const [sortAsc, setSortAsc] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (!watchlist.length) return;
    setLoading(true);
    const r: Record<string, StockQuote> = {};
    await Promise.allSettled(watchlist.map(async (w) => {
      try { const res = await fetch(`/api/quote?symbol=${w.symbol}`); if (res.ok) r[w.symbol] = await res.json(); } catch { /**/ }
    }));
    setQuotes(r);
    setLastUpdate(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }, [watchlist]);

  const fetchNews = useCallback(async () => {
    try { const res = await fetch("/api/news"); if (res.ok) setNews(await res.json()); } catch { /**/ }
  }, []);

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      if (res.ok) setMarketIndex(await res.json());
    } catch { /**/ }
  }, []);

  const fetchUsMarket = useCallback(async () => {
    try {
      const res = await fetch("/api/us-market");
      if (res.ok) setUsMarket(await res.json());
    } catch { /**/ }
  }, []);

  const fetchSectors = useCallback(async () => {
    try {
      const res = await fetch("/api/sectors");
      if (res.ok) setSectors(await res.json());
    } catch { /**/ }
  }, []);

  useEffect(() => { fetchQuotes(); fetchNews(); fetchMarket(); fetchUsMarket(); fetchSectors(); }, [fetchQuotes, fetchNews, fetchMarket, fetchUsMarket, fetchSectors]);
  useEffect(() => {
    intervalRef.current = setInterval(fetchQuotes, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchQuotes]);

  const watchlistSectors = watchlist.flatMap((w) => {
    const s: string[] = [];
    if (["2330","2454","2382"].includes(w.symbol)) s.push("AI/半導體");
    if (["2317","2308"].includes(w.symbol)) s.push("科技/電子");
    if (["2881","2882","2891"].includes(w.symbol)) s.push("銀行/金融");
    if (["2603","2609","2615"].includes(w.symbol)) s.push("航運/油價");
    return s;
  });

  interface Row extends WatchlistItem {
    price: number; changePercent: number;
    todayPnl: number; todayPnlPct: number;
    totalPnl: number; totalPnlPct: number;
    marketValue: number; hasPnl: boolean;
  }

  const rows: Row[] = watchlist.map((w) => {
    const q = quotes[w.symbol];
    const price = q?.price ?? 0;
    const prev = q?.prevClose ?? 0;
    const changePercent = q?.changePercent ?? 0;
    const hasPnl = !!(w.cost && w.shares && price > 0);
    const sh = w.shares ?? 0, co = w.cost ?? 0;
    const todayPnl = hasPnl && prev > 0 ? (price - prev) * sh : 0;
    const todayPnlPct = hasPnl && prev > 0 ? (price - prev) / prev * 100 : 0;
    const totalPnl = hasPnl ? (price - co) * sh : 0;
    const totalPnlPct = hasPnl && co > 0 ? (price - co) / co * 100 : 0;
    return { ...w, price, changePercent, todayPnl, todayPnlPct, totalPnl, totalPnlPct, marketValue: hasPnl ? price * sh : 0, hasPnl };
  });

  const sorted = [...rows].sort((a, b) => {
    const v = { name: a.name.localeCompare(b.name), todayPnl: a.todayPnl - b.todayPnl, change: a.changePercent - b.changePercent, totalPnl: a.totalPnl - b.totalPnl };
    return sortAsc ? v[sortKey] : -v[sortKey];
  });

  const pnlRows = rows.filter((r) => r.hasPnl);
  const totalMV = pnlRows.reduce((s, r) => s + r.marketValue, 0);
  const totalCost = pnlRows.reduce((s, r) => s + (r.cost! * r.shares!), 0);
  const totalPnl = pnlRows.reduce((s, r) => s + r.totalPnl, 0);
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost * 100 : 0;
  const todayPnl = pnlRows.reduce((s, r) => s + r.todayPnl, 0);
  const todayPnlPct = totalCost > 0 ? todayPnl / totalCost * 100 : 0;
  const profits = pnlRows.filter((r) => r.totalPnl > 0);
  const losses = pnlRows.filter((r) => r.totalPnl <= 0);
  const profitMV = profits.reduce((s, r) => s + r.marketValue, 0);
  const profitPct = totalMV > 0 ? profitMV / totalMV * 100 : 0;
  const totalProfit = profits.reduce((s, r) => s + r.totalPnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r.totalPnl, 0));

  const handleSort = (k: SortKey) => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false); } };

  const handleAdd = () => {
    if (!addSymbol.trim()) return;
    setWatchlist((p) => [...p.filter((w) => w.symbol !== addSymbol.trim()), {
      symbol: addSymbol.trim(), name: addName.trim() || addSymbol.trim(),
      cost: addCost ? parseFloat(addCost) : undefined,
      shares: addShares ? parseInt(addShares) : undefined,
    }]);
    setAddSymbol(""); setAddName(""); setAddCost(""); setAddShares(""); setShowAdd(false);
  };

  const sendLine = async () => {
    setNotifying(true);
    const lines = rows.map((r) =>
      r.price > 0 ? `${r.name}(${r.symbol}) ${r.price} ${fmtPct(r.changePercent)}${r.hasPnl ? ` 損益${r.totalPnl >= 0 ? "+" : ""}${fmtNum(r.totalPnl)}` : ""}` : `${r.name}: 載入中`
    );
    try { await fetch("/api/line-notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `📊 台股戰情室 ${new Date().toLocaleString("zh-TW")}\n\n${lines.join("\n")}` }) }); } catch { /**/ }
    setNotifying(false);
  };

  // ── Sort header button ──
  const SortBtn = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <button onClick={() => handleSort(k)}
      className={`flex items-center gap-0.5 text-[11px] text-gray-500 ${right ? "justify-end ml-auto" : ""}`}>
      {label}
      <span className="text-gray-600">{sortKey === k ? (sortAsc ? "↑" : "↓") : "⇅"}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col">
      {/* ── Top header ── */}
      <header className="sticky top-0 z-50 bg-[#111]/95 backdrop-blur border-b border-[#222]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Search size={18} className="text-gray-400" />
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-sm">資產</span>
              <span className="bg-[#333] text-white text-sm font-medium px-3 py-1 rounded-full">庫存</span>
              <span className="text-gray-400 text-sm ml-1">討論</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={sendLine} disabled={notifying}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#06c755] text-black text-xs font-bold">
              {notifying ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />} LINE
            </button>
            <button onClick={() => setShowAdd(true)} className="p-1.5 rounded-full bg-[#222]">
              <Plus size={15} className="text-gray-300" />
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-2">
            <button onClick={fetchQuotes} disabled={loading}
              className="flex items-center gap-1 border border-[#e07000] text-[#e07000] text-xs px-3 py-1 rounded-md">
              {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              全部更新
            </button>
          </div>
          <div className="text-[10px] text-gray-500 text-right">
            上次更新<br />{lastUpdate || "--:--"}
          </div>
        </div>

        {/* Sub tabs - hide when on standalone pages */}
        {!["大盤", "自選股", "選股"].includes(activeBottom) && <div className="flex border-t border-[#222]">
          {(["庫存股", "K線圖", "新聞"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === t ? "border-[#e07000] text-white" : "border-transparent text-gray-500"
              }`}>
              {t === "K線圖" && <TrendingUp size={11} className="inline mr-1" />}
              {t === "新聞" && <Globe size={11} className="inline mr-1" />}
              {t}
            </button>
          ))}
        </div>}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto pb-20">

        {/* ── 大盤 ── */}
        {activeBottom === "大盤" && (
          <div>
            {/* 橫向 sub-tabs */}
            <div className="flex overflow-x-auto border-b border-[#222] bg-[#111] scrollbar-hide">
              {(["台灣指數", "美股行情", "產業即時"] as const).map((t) => (
                <button key={t} onClick={() => setMarketTab(t)}
                  className={`px-4 py-2.5 text-sm whitespace-nowrap font-medium transition-colors border-b-2 ${
                    marketTab === t ? "border-[#e07000] text-white" : "border-transparent text-gray-500"
                  }`}>{t}</button>
              ))}
            </div>

            {/* ── 台灣指數 ── */}
            {marketTab === "台灣指數" && (
              <div className="pb-4">
                {/* 3-box 指數 */}
                <div className="grid grid-cols-3 gap-0 border-b border-[#222]">
                  {marketIndex.length === 0
                    ? [1,2,3].map((i) => <div key={i} className="p-3 border-r border-[#222] last:border-0 animate-pulse"><div className="h-3 bg-[#222] rounded mb-2 w-16"/><div className="h-5 bg-[#222] rounded"/></div>)
                    : marketIndex.slice(0,3).map((m, i) => (
                      <div key={m.name} className={`p-3 ${i === 2 ? "border-l-2 border-[#e07000] bg-[#1a1505]" : "border-r border-[#222]"}`}>
                        <div className="text-[10px] text-gray-500 mb-1">{m.name}</div>
                        <div className="text-[16px] font-bold tabular-nums" style={{ color: m.up ? "#e74c3c" : "#2ecc71" }}>{m.value}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: m.up ? "#e74c3c" : "#2ecc71" }}>
                          {m.up ? "▲" : "▼"}{m.change}({m.pct})
                        </div>
                      </div>
                    ))
                  }
                </div>
                {/* 焦點快訊 */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white border-l-4 border-[#e07000] pl-2">焦點快訊</span>
                    <span className="text-xs text-[#e07000]">更多 &gt;</span>
                  </div>
                  {news.slice(0, 3).map((n, i) => (
                    <div key={n.id} className="flex items-start gap-3 py-2.5 border-b border-[#1a1a1a]">
                      <span className="text-[#e07000] text-sm font-bold w-6 flex-shrink-0">{String(i+1).padStart(2,"0")}</span>
                      <span className="text-sm text-white leading-snug flex-1">{n.title}</span>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">{n.source?.split("·")[1]?.trim() ?? ""}</span>
                    </div>
                  ))}
                </div>
                {/* 指數明細 */}
                <div className="px-4 pt-2">
                  {marketIndex.slice(1).map((m) => (
                    <div key={m.name} className="flex items-center justify-between py-3 border-b border-[#1a1a1a]">
                      <span className="text-sm text-gray-300">{m.name} &gt;</span>
                      <div className="text-right">
                        <span className="text-base font-bold tabular-nums mr-3" style={{ color: m.up ? "#e74c3c" : "#2ecc71" }}>{m.value}</span>
                        <span className="text-sm" style={{ color: m.up ? "#e74c3c" : "#2ecc71" }}>
                          {m.up ? "▲" : "▼"}{m.change}({m.pct})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 美股行情 ── */}
            {marketTab === "美股行情" && (
              <div className="pb-4">
                {/* 期貨 3-box */}
                <div className="grid grid-cols-3 gap-0 border-b border-[#222]">
                  {(!usMarket?.futures?.length ? [1,2,3] : usMarket.futures).map((item, i) => {
                    if (typeof item === "number") return <div key={i} className="p-3 border-r border-[#222] last:border-0 animate-pulse"><div className="h-3 bg-[#222] rounded mb-2 w-16"/><div className="h-5 bg-[#222] rounded"/></div>;
                    const m = item as MarketItem;
                    return (
                      <div key={m.label} className={`p-3 ${i === 0 ? "border-2 border-[#e07000] bg-[#1a1505]" : "border-r border-[#222]"}`}>
                        <div className="text-[10px] text-gray-500 mb-1">{m.label}</div>
                        <div className="text-[15px] font-bold tabular-nums" style={{ color: m.up ? "#e74c3c" : m.up === false ? "#2ecc71" : "#aaa" }}>{m.price}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: m.up ? "#e74c3c" : m.up === false ? "#2ecc71" : "#888" }}>
                          {m.up === true ? "▲" : m.up === false ? "▼" : ""}{m.change}({m.pct})
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 盤後焦點個股標題 */}
                <div className="px-4 pt-4 pb-2">
                  <span className="text-sm font-bold text-white border-l-4 border-[#e07000] pl-2">美股指數</span>
                </div>
                {/* 美股指數明細 */}
                {(!usMarket?.indices?.length ? [] : usMarket.indices).map((m) => (
                  <div key={m.label} className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a1a]">
                    <span className="text-sm text-gray-300">{m.label} &gt;</span>
                    <div className="text-right">
                      <span className="text-base font-bold tabular-nums mr-3" style={{ color: m.up ? "#e74c3c" : m.up === false ? "#2ecc71" : "#aaa" }}>{m.price}</span>
                      <span className="text-sm" style={{ color: m.up ? "#e74c3c" : m.up === false ? "#2ecc71" : "#888" }}>
                        {m.up === true ? "▼" : m.up === false ? "▼" : ""}{m.change}({m.pct})
                      </span>
                    </div>
                  </div>
                ))}
                {!usMarket && <div className="text-center text-gray-600 py-10 text-sm">美股資料載入中...</div>}
              </div>
            )}

            {/* ── 產業即時 ── */}
            {marketTab === "產業即時" && (
              <div className="pb-4">
                <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                  {(["漲幅", "跌幅"] as const).map((s) => (
                    <button key={s} onClick={() => setSectorSort(s)}
                      className={`px-4 py-1.5 rounded text-sm font-medium ${sectorSort === s ? "bg-[#e07000] text-white" : "bg-[#222] text-gray-400"}`}>{s}</button>
                  ))}
                </div>
                {/* 產業排行標題 */}
                <div className="px-4 mb-2">
                  <span className="text-sm font-bold text-white border-l-4 border-[#e07000] pl-2">產業排行</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-3">
                  {sectors.length === 0
                    ? [1,2,3,4,5,6].map((i) => <div key={i} className="bg-[#1a1a1a] rounded-xl p-3 animate-pulse h-20" />)
                    : [...sectors]
                      .sort((a, b) => {
                        const ap = parseFloat(a.pct?.replace("%","") ?? "0");
                        const bp = parseFloat(b.pct?.replace("%","") ?? "0");
                        return sectorSort === "漲幅" ? bp - ap : ap - bp;
                      })
                      .slice(0, 6)
                      .map((s) => {
                        const pctNum = parseFloat(s.pct?.replace("%","") ?? "0");
                        const isUp = s.up !== undefined ? s.up : pctNum >= 0;
                        const color = isUp ? "#e74c3c" : "#2ecc71";
                        return (
                          <div key={s.name} className="bg-[#1a1a1a] rounded-xl p-3">
                            <div className="text-[10px] text-gray-500 mb-1">產業</div>
                            <div className="text-[13px] font-bold text-white leading-tight mb-1">{s.name}</div>
                            <div className="text-[15px] font-bold" style={{ color }}>
                              {isUp ? "▲" : "▼"}{Math.abs(pctNum).toFixed(2)}%
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
                {/* 資金流向 */}
                <div className="px-4 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white border-l-4 border-[#e07000] pl-2">持股板塊分布</span>
                  </div>
                  {[...new Set(watchlistSectors)].length === 0
                    ? <div className="text-gray-600 text-sm text-center py-4 bg-[#1a1a1a] rounded-xl">新增含板塊標籤的持股後顯示</div>
                    : [...new Set(watchlistSectors)].map((s) => (
                      <div key={s} className="flex items-center gap-2 py-2.5 border-b border-[#1a1a1a]">
                        <span className="w-2 h-2 rounded-full bg-[#e07000]" />
                        <span className="text-sm text-white">{s}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 自選股 ── */}
        {activeBottom === "自選股" && (
          <div className="p-3">
            <div className="text-xs text-gray-500 mb-3">自選觀察清單（點擊查看 K 線）</div>
            {watchlist.map((w) => {
              const q = quotes[w.symbol];
              const cp = q?.changePercent ?? 0;
              return (
                <div key={w.symbol}
                  className="flex items-center justify-between bg-[#1a1a1a] rounded-xl px-4 py-3 mb-2 cursor-pointer active:bg-[#222]"
                  onClick={() => { setSelectedSymbol(w.symbol); setActiveBottom("K線"); setActiveTab("K線圖"); }}>
                  <div>
                    <div className="text-sm font-bold text-white">{w.name}</div>
                    <div className="text-[11px] text-gray-500">{w.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-white tabular-nums">{q?.price?.toFixed(1) ?? "—"}</div>
                    {q?.price ? (
                      <div className="inline-block text-[11px] font-bold px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: cp >= 0 ? "#e74c3c" : "#2ecc71" }}>
                        {fmtPct(cp)}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <button onClick={() => setShowAdd(true)} className="w-full py-3 rounded-xl bg-[#1a1a1a] text-[#e07000] text-sm font-medium border border-[#333] mt-1">
              + 新增自選股
            </button>
          </div>
        )}

        {/* ── 選股 ── */}
        {activeBottom === "選股" && (
          <div className="p-3">
            <div className="bg-[#1a1a1a] rounded-xl p-5 text-center">
              <Layers size={32} className="text-gray-600 mx-auto mb-3" />
              <div className="text-sm text-gray-400 mb-1">選股功能開發中</div>
              <div className="text-[11px] text-gray-600">即將支援：條件篩選、主力籌碼、外資動向</div>
            </div>
            <div className="mt-3 space-y-2">
              {[["AI/半導體", "2330,2454,3711"], ["航運", "2603,2609,2615"], ["金融", "2881,2882,2891"]].map(([sector, syms]) => (
                <div key={sector} className="bg-[#1a1a1a] rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">{sector}</div>
                  <div className="flex gap-2 flex-wrap">
                    {syms.split(",").map((s) => (
                      <button key={s} onClick={() => {
                        if (!watchlist.find((w) => w.symbol === s)) {
                          setWatchlist((p) => [...p, { symbol: s, name: s }]);
                        }
                        setSelectedSymbol(s); setActiveBottom("K線"); setActiveTab("K線圖");
                      }} className="px-3 py-1.5 bg-[#222] rounded-lg text-xs text-gray-300 active:bg-[#333]">{s}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 庫存股 ── */}
        {activeBottom !== "大盤" && activeBottom !== "自選股" && activeBottom !== "選股" && activeTab === "庫存股" && (
          <div>
            {/* Summary card */}
            {pnlRows.length > 0 && (
              <div className="mx-3 mt-3 bg-[#1a1a1a] rounded-xl p-4 grid grid-cols-3 gap-1">
                <div>
                  <div className="text-[10px] text-gray-500">今日損益</div>
                  <div className="text-[22px] font-bold tabular-nums leading-tight" style={{ color: numColor(todayPnl) }}>
                    {todayPnl >= 0 ? "+" : ""}{fmtNum(todayPnl)}
                  </div>
                  <div className="text-[11px]" style={{ color: numColor(todayPnl) }}>{fmtPct(todayPnlPct)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">累積損益</div>
                  <div className="text-[22px] font-bold tabular-nums leading-tight" style={{ color: numColor(totalPnl) }}>
                    {totalPnl >= 0 ? "+" : ""}{fmtNum(totalPnl)}
                  </div>
                  <div className="text-[11px]" style={{ color: numColor(totalPnl) }}>{fmtPct(totalPnlPct)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">股票市值</div>
                  <div className="text-[22px] font-bold tabular-nums leading-tight text-white">{fmtNum(totalMV)}</div>
                  <div className="text-[11px] text-gray-500">成本 {fmtNum(totalCost)}</div>
                </div>
              </div>
            )}

            {/* Pie + stats */}
            {pnlRows.length > 0 && (
              <div className="mx-3 mt-2 bg-[#1a1a1a] rounded-xl p-4 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <PieChart profitPct={profitPct} />
                  <div className="absolute inset-0 flex flex-col items-end justify-center pr-0 pointer-events-none" style={{ right: "-28px" }}>
                    <div className="text-[11px] font-bold" style={{ color: "#e74c3c" }}>{Math.round(profitPct)}%</div>
                    <div className="text-[11px] font-bold" style={{ color: "#2ecc71" }}>{Math.round(100 - profitPct)}%</div>
                  </div>
                </div>
                <div className="flex-1 ml-6">
                  <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
                    <span style={{ color: "#e74c3c" }}>■</span>
                    <span style={{ color: "#2ecc71" }}>■</span>
                    盈虧市值估比
                  </div>
                  <div className="space-y-2">
                    <div className="pl-2 border-l-2 border-[#e74c3c]">
                      <div className="text-[11px] text-gray-400">獲利檔數：<span style={{ color: "#e74c3c" }} className="font-medium">{profits.length} 檔</span></div>
                      <div className="text-[11px] text-gray-400">獲利金額：<span style={{ color: "#e74c3c" }} className="font-medium">{fmtNum(totalProfit)} 元</span></div>
                    </div>
                    <div className="pl-2 border-l-2 border-[#2ecc71]">
                      <div className="text-[11px] text-gray-400">虧損檔數：<span style={{ color: "#2ecc71" }} className="font-medium">{losses.length} 檔</span></div>
                      <div className="text-[11px] text-gray-400">虧損金額：<span style={{ color: "#2ecc71" }} className="font-medium">{fmtNum(totalLoss)} 元</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Table header */}
            <div className="grid grid-cols-12 px-4 py-2 mt-1 border-b border-[#222] text-[11px] text-gray-500">
              <div className="col-span-4"><SortBtn k="name" label="庫存股" /></div>
              <div className="col-span-3 text-right"><SortBtn k="todayPnl" label="今日損益" right /></div>
              <div className="col-span-3 text-right"><SortBtn k="change" label="股價漲跌幅" right /></div>
              <div className="col-span-2 text-right"><SortBtn k="totalPnl" label="總損益" right /></div>
            </div>

            {/* Stock rows */}
            {sorted.map((row) => (
              <div key={row.symbol}
                className="grid grid-cols-12 items-center px-4 py-3.5 border-b border-[#1a1a1a] cursor-pointer active:bg-[#1a1a1a]"
                onClick={() => { setSelectedSymbol(row.symbol); setActiveTab("K線圖"); }}>
                {/* Stock name */}
                <div className="col-span-4">
                  <div className="text-[9px] text-gray-500 bg-[#222] inline-block px-1.5 py-0.5 rounded mb-0.5">現股</div>
                  <div className="text-[17px] font-bold leading-tight">{row.name}</div>
                  <div className="text-[11px] text-gray-500">{row.symbol}</div>
                </div>
                {/* Today P&L */}
                <div className="col-span-3 text-right">
                  {row.hasPnl ? (
                    <>
                      <div className="text-[15px] font-semibold tabular-nums" style={{ color: numColor(row.todayPnl) }}>
                        {row.todayPnl >= 0 ? "+" : ""}{fmtNum(row.todayPnl)}
                      </div>
                    </>
                  ) : <span className="text-gray-600 text-sm">—</span>}
                </div>
                {/* Price + change */}
                <div className="col-span-3 text-right">
                  {row.price > 0 ? (
                    <>
                      <div className="text-[15px] font-semibold tabular-nums text-white">{row.price.toFixed(1)}</div>
                      <div className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5 text-white"
                        style={{ backgroundColor: numColor(row.changePercent) }}>
                        {fmtPct(row.changePercent)}
                      </div>
                    </>
                  ) : <span className="text-gray-600">—</span>}
                </div>
                {/* Total P&L */}
                <div className="col-span-2 text-right">
                  {row.hasPnl ? (
                    <>
                      <div className="text-[13px] font-semibold tabular-nums" style={{ color: numColor(row.totalPnl) }}>
                        {row.totalPnl >= 0 ? "+" : ""}{fmtNum(row.totalPnl)}
                      </div>
                      <div className="text-[10px]" style={{ color: numColor(row.totalPnl) }}>{fmtPct(row.totalPnlPct)}</div>
                    </>
                  ) : <span className="text-gray-600 text-xs">—</span>}
                </div>
              </div>
            ))}

            {watchlist.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <p className="mb-3">還沒有自選股</p>
                <button onClick={() => setShowAdd(true)} className="text-sm text-[#e07000]">點此新增</button>
              </div>
            )}
          </div>
        )}

        {/* ── K線圖 ── */}
        {activeBottom !== "大盤" && activeBottom !== "自選股" && activeBottom !== "選股" && activeTab === "K線圖" && (
          <div className="p-3">
            <div className="flex gap-2 mb-3 flex-wrap">
              {watchlist.map((item) => (
                <button key={item.symbol} onClick={() => setSelectedSymbol(item.symbol)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSymbol === item.symbol ? "bg-[#e07000] text-white" : "bg-[#222] text-gray-400"
                  }`}>
                  {item.name}{quotes[item.symbol]?.price > 0 ? ` ${quotes[item.symbol].price.toFixed(1)}` : ""}
                </button>
              ))}
            </div>
            <div className="h-[480px] rounded-xl overflow-hidden bg-[#1a1a1a]">
              <TradingViewChart symbol={selectedSymbol} />
            </div>
          </div>
        )}

        {/* ── 新聞/動向 ── */}
        {activeBottom !== "大盤" && activeBottom !== "自選股" && activeBottom !== "選股" && activeTab === "新聞" && (
          activeBottom === "動向" ? (
            <div className="pb-4">
              <div className="px-4 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white border-l-4 border-[#e07000] pl-2">動向快訊</span>
                  <span className="text-xs text-[#e07000]">全部</span>
                </div>
                {news.length === 0
                  ? <div className="text-center text-gray-600 py-12">新聞載入中...</div>
                  : news.map((n, i) => {
                      let timeAgo = "";
                      try { timeAgo = formatDistanceToNow(new Date(n.publishedAt), { addSuffix: true, locale: zhTW }); } catch { /**/ }
                      return (
                        <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 py-3 border-b border-[#1a1a1a] active:bg-[#1a1a1a]">
                          <span className="text-[#e07000] text-sm font-bold w-6 flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-sm text-white leading-snug flex-1">{n.title}</span>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">{timeAgo}</span>
                        </a>
                      );
                    })
                }
              </div>
            </div>
          ) : (
            <div className="p-3">
              <p className="text-[11px] text-gray-500 mb-3">⚡ 影響你自選股板塊的新聞高亮</p>
              {news.length === 0
                ? <div className="text-center text-gray-600 py-12">新聞載入中...</div>
                : <div className="grid gap-3">{news.map((n) => <NewsCard key={n.id} news={n} watchlistSectors={watchlistSectors} />)}</div>}
            </div>
          )
        )}
      </main>

      {/* ── Bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] flex">
        {([
          { icon: <BarChart2 size={20} />, label: "庫存股" as BottomNav },
          { icon: <Activity size={20} />, label: "自選股" as BottomNav },
          { icon: <Layers size={20} />, label: "選股" as BottomNav },
          { icon: <Globe size={20} />, label: "大盤" as BottomNav },
          { icon: <Radio size={20} />, label: "動向" as BottomNav },
          { icon: <TrendingUp size={20} />, label: "K線" as BottomNav },
        ] as { icon: React.ReactNode; label: BottomNav }[]).map(({ icon, label }) => (
          <button key={label} onClick={() => {
            setActiveBottom(label);
            if (label === "K線") setActiveTab("K線圖");
            else if (label === "動向") setActiveTab("新聞");
            else setActiveTab("庫存股");
          }}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              activeBottom === label ? "text-[#e07000]" : "text-gray-600"
            }`}>
            {icon}
            <span className="text-[9px]">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Add modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-[#1a1a1a] rounded-t-2xl p-6 w-full border-t border-[#333]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">新增自選股</h2>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">股票代號（必填）</label>
                <input value={addSymbol} onChange={(e) => setAddSymbol(e.target.value)} placeholder="例：2330"
                  autoFocus onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#e07000]" />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">股票名稱（選填）</label>
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="例：台積電"
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#e07000]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">買入成本</label>
                  <input value={addCost} onChange={(e) => setAddCost(e.target.value)} placeholder="例：580" type="number"
                    className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#e07000]" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">持有股數</label>
                  <input value={addShares} onChange={(e) => setAddShares(e.target.value)} placeholder="例：1000" type="number"
                    className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#e07000]" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl bg-[#222] text-sm">取消</button>
              <button onClick={handleAdd} disabled={!addSymbol.trim()}
                className="flex-1 py-3 rounded-xl bg-[#e07000] text-sm font-bold disabled:opacity-40">新增</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
