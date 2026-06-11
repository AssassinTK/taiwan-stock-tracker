import { RestClient } from "@fugle/marketdata";

let client: RestClient | null = null;

function getClient() {
  if (!client) {
    client = new RestClient({ apiKey: process.env.FUGLE_API_KEY! });
  }
  return client;
}

export async function getQuote(symbol: string) {
  const fugle = getClient();
  try {
    const data = await fugle.stock.intraday.quote({ symbol });
    return data;
  } catch {
    return null;
  }
}

export async function getSnapshot(symbols: string[]) {
  const fugle = getClient();
  try {
    const data = await fugle.stock.snapshot.quotes({ market: "TSE" });
    if (!data?.data) return [];
    return data.data.filter((q: { symbol: string }) =>
      symbols.includes(q.symbol)
    );
  } catch {
    return [];
  }
}

// Fallback: TWSE open API (no key needed, delayed)
export async function getTWSEQuote(symbol: string) {
  try {
    const res = await fetch(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${symbol}.tw&_=${Date.now()}`,
      { next: { revalidate: 5 } }
    );
    const json = await res.json();
    const d = json?.msgArray?.[0];
    if (!d) return null;
    return {
      symbol,
      price: parseFloat(d.z) || parseFloat(d.y),
      open: parseFloat(d.o),
      high: parseFloat(d.h),
      low: parseFloat(d.l),
      prevClose: parseFloat(d.y),
      volume: parseInt(d.v),
      limitUp: parseFloat(d.u),
      limitDown: parseFloat(d.w),
      name: d.n,
    };
  } catch {
    return null;
  }
}
