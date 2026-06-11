import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "2330";
  const range = req.nextUrl.searchParams.get("range") ?? "3mo";
  const yahooSymbol = symbol.endsWith(".TW") ? symbol : `${symbol}.TW`;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ error: "fetch failed" }, { status: 502 });

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: "no data" }, { status: 404 });

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: (number | null)[] = quote.open ?? [];
    const highs: (number | null)[] = quote.high ?? [];
    const lows: (number | null)[] = quote.low ?? [];
    const closes: (number | null)[] = quote.close ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    const candles = timestamps
      .map((ts, i) => ({
        time: ts as number,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      }))
      .filter((c) => c.open != null && c.close != null) as {
        time: number; open: number; high: number; low: number; close: number; volume: number;
      }[];

    return NextResponse.json({ symbol: yahooSymbol, candles });
  } catch {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
