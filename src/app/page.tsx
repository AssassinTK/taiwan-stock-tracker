"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Bell, RefreshCw, Activity, Globe, TrendingUp, Loader2 } from "lucide-react";
import StockCard from "@/components/StockCard";
import TradingViewChart from "@/components/TradingViewChart";
import NewsCard from "@/components/NewsCard";
import PortfolioChart from "@/components/PortfolioChart";
import { StockQuote, WatchlistItem, NewsItem, PortfolioItem } from "@/types/stock";

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "2330", name: "台積電" },
  { symbol: "2317", name: "鴻海" },
  { symbol: "0050", name: "元大台灣50" },
];

const TABS = ["自選股", "K線圖", "新聞", "損益"] as const;
type Tab = (typeof TABS)[number];

function useLocalStorage<T>(key: string, init: T) {
  const [val, setVal] = useState<T>(init);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) setVal(JSON.parse(s));
    } catch { /* ignore */ }
  }, [key]);
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setVal((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key]
  );
  return [val, set] as const;
}

const EMPTY_QUOTE = (symbol: string, name: string): StockQuote => ({
  symbol, name, price: 0, change: 0, changePercent: 0,
  volume: 0, high: 0, low: 0, open: 0, prevClose: 0,
  limitUp: 0, limitDown: 0, updatedAt: "",
});

export default function Home() {
  const [watchlist, setWatchlist] = useLocalStorage<WatchlistItem[]>("watchlist", DEFAULT_WATCHLIST);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("自選股");
  const [selectedSymbol, setSelectedSymbol] = useState("2330");
  const [loading, setLoading] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addName, setAddName] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addShares, setAddShares] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [notifying, setNotifying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (watchlist.length === 0) return;
    setLoading(true);
    const results: Record<string, StockQuote> = {};
    await Promise.allSettled(
      watchlist.map(async (item) => {
        try {
          const res = await fetch(`/api/quote?symbol=${item.symbol}`);
          if (res.ok) results[item.symbol] = await res.json();
        } catch { /* skip */ }
      })
    );
    setQuotes(results);
    setLastUpdate(new Date().toLocaleTimeString("zh-TW"));
    setLoading(false);
  }, [watchlist]);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news");
      if (res.ok) setNews(await res.json());
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchNews();
  }, [fetchQuotes, fetchNews]);

  useEffect(() => {
    intervalRef.current = setInterval(fetchQuotes, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchQuotes]);

  const watchlistSectors = watchlist.flatMap((w) => {
    const sectors: string[] = [];
    if (["2330", "2454", "2382"].includes(w.symbol)) sectors.push("AI/半導體");
    if (["2317", "2308"].includes(w.symbol)) sectors.push("科技/電子");
    if (["2881", "2882", "2891"].includes(w.symbol)) sectors.push("銀行/金融");
    if (["2603", "2609", "2615"].includes(w.symbol)) sectors.push("航運/油價");
    return sectors;
  });

  const handleAdd = () => {
    if (!addSymbol.trim()) return;
    const item: WatchlistItem = {
      symbol: addSymbol.trim(),
      name: addName.trim() || addSymbol.trim(),
      cost: addCost ? parseFloat(addCost) : undefined,
      shares: addShares ? parseInt(addShares) : undefined,
    };
    setWatchlist((prev) => [...prev.filter((w) => w.symbol !== item.symbol), item]);
    setAddSymbol(""); setAddName(""); setAddCost(""); setAddShares("");
    setShowAdd(false);
  };

  const portfolioItems: PortfolioItem[] = watchlist
    .filter((w) => w.cost && w.shares && quotes[w.symbol])
    .map((w) => {
      const q = quotes[w.symbol];
      return {
        ...w,
        currentPrice: q.price,
        marketValue: q.price * w.shares!,
        pnl: (q.price - w.cost!) * w.shares!,
        pnlPercent: ((q.price - w.cost!) / w.cost!) * 100,
      };
    });

  const sendLineNotify = async () => {
    setNotifying(true);
    const lines = watchlist.map((w) => {
      const q = quotes[w.symbol];
      if (!q || q.price === 0) return `${w.name}(${w.symbol}): 資料載入中`;
      const sign = q.change >= 0 ? "▲" : "▼";
      return `${q.name}(${q.symbol}): ${q.price.toFixed(2)} ${sign}${Math.abs(q.change).toFixed(2)}(${q.changePercent.toFixed(1)}%)`;
    });
    const message = `\n📊 台股戰情室 ${new Date().toLocaleString("zh-TW")}\n\n${lines.join("\n")}`;
    try {
      await fetch("/api/line-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } catch { /* ignore */ }
    setNotifying(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f1117]/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-400" size={20} />
            <h1 className="font-bold text-lg">台股戰情室</h1>
            {lastUpdate && (
              <span className="text-xs text-gray-500 hidden sm:block">更新 {lastUpdate}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchQuotes}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="立即更新"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button
              onClick={sendLineNotify}
              disabled={notifying}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 transition-colors text-sm"
            >
              {notifying ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
              LINE
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-4">
        <div className="max-w-7xl mx-auto flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab === "自選股" && <Activity size={14} className="inline mr-1" />}
              {tab === "K線圖" && <TrendingUp size={14} className="inline mr-1" />}
              {tab === "新聞" && <Globe size={14} className="inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* 自選股 */}
        {activeTab === "自選股" && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
              {watchlist.map((item) => (
                <StockCard
                  key={item.symbol}
                  quote={quotes[item.symbol] ?? EMPTY_QUOTE(item.symbol, item.name)}
                  cost={item.cost}
                  shares={item.shares}
                  onRemove={() => setWatchlist((prev) => prev.filter((w) => w.symbol !== item.symbol))}
                  onClick={() => { setSelectedSymbol(item.symbol); setActiveTab("K線圖"); }}
                  selected={selectedSymbol === item.symbol}
                />
              ))}
              <button
                onClick={() => setShowAdd(true)}
                className="bg-[#1a1d2e] rounded-xl p-4 border-2 border-dashed border-gray-700 hover:border-blue-500 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-blue-400 min-h-[120px]"
              >
                <Plus size={20} />
                <span className="text-sm">新增</span>
              </button>
            </div>
          </div>
        )}

        {/* K線圖 */}
        {activeTab === "K線圖" && (
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              {watchlist.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSymbol === item.symbol
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {item.name}
                  {quotes[item.symbol]?.price > 0
                    ? ` ${quotes[item.symbol].price.toFixed(1)}`
                    : ""}
                </button>
              ))}
            </div>
            <div className="h-[480px] rounded-xl overflow-hidden bg-[#1a1d2e]">
              <TradingViewChart symbol={selectedSymbol} />
            </div>
          </div>
        )}

        {/* 新聞 */}
        {activeTab === "新聞" && (
          <div>
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
              <Globe size={12} />
              影響你自選股板塊的新聞會高亮顯示 ⚡
            </p>
            {news.length === 0 ? (
              <div className="text-center text-gray-600 py-12">新聞載入中...</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {news.map((n) => (
                  <NewsCard key={n.id} news={n} watchlistSectors={watchlistSectors} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 損益 */}
        {activeTab === "損益" && (
          <div>
            {portfolioItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">還沒設定持股成本</p>
                <p className="text-gray-600 text-sm">新增自選股時填入「買入成本」和「股數」即可計算損益</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="bg-[#1a1d2e] rounded-xl p-4">
                  <h2 className="text-sm font-medium text-gray-400 mb-3">持倉分布</h2>
                  <PortfolioChart items={portfolioItems} />
                </div>
                <div className="bg-[#1a1d2e] rounded-xl p-4">
                  <h2 className="text-sm font-medium text-gray-400 mb-3">個股損益</h2>
                  <div className="space-y-3">
                    {portfolioItems.map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <div className="text-sm font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">
                            成本 {item.cost} × {item.shares} 股
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${item.pnl >= 0 ? "text-red-400" : "text-green-400"}`}>
                            {item.pnl >= 0 ? "+" : ""}{item.pnl.toFixed(0)} 元
                          </div>
                          <div className={`text-xs ${item.pnlPercent >= 0 ? "text-red-400" : "text-green-400"}`}>
                            {item.pnlPercent >= 0 ? "+" : ""}{item.pnlPercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div className="bg-[#1a1d2e] rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">新增自選股</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">股票代號（必填）</label>
                <input
                  value={addSymbol}
                  onChange={(e) => setAddSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="例：2330"
                  autoFocus
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">股票名稱（選填）</label>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="例：台積電"
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">買入成本（選填）</label>
                  <input
                    value={addCost}
                    onChange={(e) => setAddCost(e.target.value)}
                    placeholder="例：580"
                    type="number"
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">持有股數（選填）</label>
                  <input
                    value={addShares}
                    onChange={(e) => setAddShares(e.target.value)}
                    placeholder="例：1000"
                    type="number"
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={!addSymbol.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm transition-colors disabled:opacity-50"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
