import { NextRequest, NextResponse } from "next/server";
import { getQuote, getTWSEQuote } from "@/lib/fugle";
import type { StockQuote } from "@/types/stock";

const STOCK_NAMES: Record<string, string> = {
  "2330": "台積電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2308": "台達電",
  "2412": "中華電",
  "2881": "富邦金",
  "0050": "元大台灣50",
  "0056": "元大高股息",
  "2002": "中鋼",
  "2382": "廣達",
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  // Try Fugle first, fallback to TWSE
  let quote: StockQuote | null = null;

  if (process.env.FUGLE_API_KEY && process.env.FUGLE_API_KEY !== "your_fugle_api_key_here") {
    try {
      const data = await getQuote(symbol);
      if (data) {
        const price = data.lastPrice ?? data.closePrice ?? 0;
        const prevClose = price - (data.change ?? 0);
        quote = {
          symbol,
          name: data.name || STOCK_NAMES[symbol] || symbol,
          price,
          change: data.change ?? 0,
          changePercent: data.changePercent ?? 0,
          volume: data.total?.tradeVolume ?? 0,
          high: data.highPrice ?? price,
          low: data.lowPrice ?? price,
          open: data.openPrice ?? price,
          prevClose,
          limitUp: prevClose * 1.1,
          limitDown: prevClose * 0.9,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch { /* fallthrough */ }
  }

  if (!quote) {
    const twse = await getTWSEQuote(symbol);
    if (twse) {
      const change = twse.price - twse.prevClose;
      quote = {
        symbol,
        name: twse.name || STOCK_NAMES[symbol] || symbol,
        price: twse.price,
        change,
        changePercent: twse.prevClose ? (change / twse.prevClose) * 100 : 0,
        volume: twse.volume,
        high: twse.high,
        low: twse.low,
        open: twse.open,
        prevClose: twse.prevClose,
        limitUp: twse.limitUp,
        limitDown: twse.limitDown,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  if (!quote) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(quote);
}
