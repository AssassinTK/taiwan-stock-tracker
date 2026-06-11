"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Bell, RefreshCw, TrendingUp, Globe, Loader2, X, Search, BarChart2, Layers, Activity, Radio } from "lucide-react";
import TradingViewChart from "@/components/TradingViewChart";
import NewsCard from "@/components/NewsCard";
import { StockQuote, WatchlistItem, NewsItem } from "@/types/stock";

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "2330", name: "台積電" },
  { symbol: "2317", name: "鴻海" },
  { symbol: "0050", name: "元大台灣50" },
];

type Tab = "庫存股" | "K線圖" | "新聞";
type SortKey = "name" | "todayPnl" | "change" | "totalPnl";

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
  const [selectedSymbol, setSelectedSymbol] = useState("2330");
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

  useEffect(() => { fetchQuotes(); fetchNews(); }, [fetchQuotes, fetchNews]);
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

        {/* Sub tabs */}
        <div className="flex border-t border-[#222]">
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
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto pb-20">

        {/* ── 庫存股 ── */}
        {activeTab === "庫存股" && (
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
        {activeTab === "K線圖" && (
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

        {/* ── 新聞 ── */}
        {activeTab === "新聞" && (
          <div className="p-3">
            <p className="text-[11px] text-gray-500 mb-3">⚡ 影響你自選股板塊的新聞高亮</p>
            {news.length === 0
              ? <div className="text-center text-gray-600 py-12">新聞載入中...</div>
              : <div className="grid gap-3">{news.map((n) => <NewsCard key={n.id} news={n} watchlistSectors={watchlistSectors} />)}</div>}
          </div>
        )}
      </main>

      {/* ── Bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] flex">
        {[
          { icon: <BarChart2 size={20} />, label: "庫存股", tab: "庫存股" as Tab },
          { icon: <Activity size={20} />, label: "自選股", tab: "庫存股" as Tab },
          { icon: <Layers size={20} />, label: "選股", tab: "庫存股" as Tab },
          { icon: <Globe size={20} />, label: "大盤", tab: "新聞" as Tab },
          { icon: <Radio size={20} />, label: "動向", tab: "新聞" as Tab },
          { icon: <TrendingUp size={20} />, label: "K線", tab: "K線圖" as Tab },
        ].map(({ icon, label, tab }) => (
          <button key={label} onClick={() => setActiveTab(tab)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              (label === "庫存股" && activeTab === "庫存股") ||
              (label === "K線" && activeTab === "K線圖") ||
              (label === "大盤" && activeTab === "新聞")
                ? "text-[#e07000]" : "text-gray-600"
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
