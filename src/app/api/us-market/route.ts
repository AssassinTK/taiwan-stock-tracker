import { NextResponse } from "next/server";

async function fetchYahoo(symbol: string, label: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 120 } });
    if (!res.ok) return { label, symbol, price: "—", change: "—", pct: "—", up: null };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = meta?.regularMarketPrice ?? meta?.previousClose ?? 0;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? 0;
    const chg = prev > 0 ? price - prev : 0;
    const pct = prev > 0 ? (chg / prev) * 100 : 0;
    const up = pct >= 0;
    return {
      label, symbol,
      price: price > 0 ? price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—",
      change: chg !== 0 ? `${up ? "+" : ""}${chg.toFixed(2)}` : "—",
      pct: pct !== 0 ? `${up ? "+" : ""}${pct.toFixed(2)}%` : "—",
      up,
    };
  } catch {
    return { label, symbol, price: "—", change: "—", pct: "—", up: null };
  }
}

export async function GET() {
  const [nq, es, ym, nasdaq, sp500, dow, sox] = await Promise.all([
    fetchYahoo("NQ=F", "小那斯達克期貨"),
    fetchYahoo("ES=F", "小S&P期貨"),
    fetchYahoo("YM=F", "小道瓊期貨"),
    fetchYahoo("%5EIXIC", "那斯達克指數"),
    fetchYahoo("%5EGSPC", "S&P500指數"),
    fetchYahoo("%5EDJI", "道瓊指數"),
    fetchYahoo("%5ESOX", "費城半導體指數"),
  ]);
  return NextResponse.json({ futures: [nq, es, ym], indices: [nasdaq, sp500, dow, sox] });
}
