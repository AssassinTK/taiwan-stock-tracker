import { NextResponse } from "next/server";

async function yahooIndex(symbol: string, label: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const chg = prev > 0 ? price - prev : 0;
    const pct = prev > 0 ? (chg / prev) * 100 : 0;
    return {
      name: label,
      value: price > 0 ? price.toLocaleString("zh-TW", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : "—",
      change: `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}`,
      pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      up: pct >= 0,
    };
  } catch { return null; }
}

async function twseIndex() {
  try {
    const res = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: Record<string, string>[] = await res.json();
    const targets = [
      { key: "加權股價指數", label: "加權指數" },
      { key: "電子類指數", label: "電子類" },
      { key: "金融保險類指數", label: "金融類" },
      { key: "未含金融保險股指數", label: "不含金融" },
    ];
    return targets.map(({ key, label }) => {
      const row = data.find((d) => d["指數名稱"] === key);
      if (!row) return null;
      const pct = parseFloat(row["漲跌百分比"] ?? "0");
      const chg = parseFloat(row["漲跌點數"] ?? "0");
      return {
        name: label,
        value: row["收盤指數"] ?? row["最新指數"] ?? "—",
        change: `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}`,
        pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
        up: pct >= 0,
      };
    }).filter(Boolean);
  } catch { return []; }
}

export async function GET() {
  const [twii, two] = await Promise.all([
    yahooIndex("%5ETWII", "加權指數"),
    yahooIndex("%5ETWO", "上櫃指數"),
  ]);

  const yahoo = [twii, two].filter(Boolean);
  if (yahoo.length >= 2) {
    const twse = await twseIndex();
    const elec = twse.find((d) => d?.name === "電子類");
    const fin = twse.find((d) => d?.name === "金融類");
    return NextResponse.json([...yahoo, elec, fin].filter(Boolean));
  }

  const twse = await twseIndex();
  if (twse.length > 0) return NextResponse.json(twse);

  return NextResponse.json([]);
}
