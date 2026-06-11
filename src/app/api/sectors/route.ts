import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 180 },
    });
    if (!res.ok) return NextResponse.json([]);
    const data: Record<string, string>[] = await res.json();

    const sectors = data
      .filter((d) => d["殖利率(%)"] !== undefined || d["本益比"] !== undefined)
      .slice(0, 30)
      .map((d) => ({
        name: d["產業別"] ?? d["名稱"] ?? "—",
        change: d["漲跌"] ?? "—",
        pct: d["漲跌%"] ?? "—",
      }));

    return NextResponse.json(sectors);
  } catch {
    // Fallback: static sector list with mock data for layout demo
    return NextResponse.json([
      { name: "AI半導體", pct: "+2.31%", up: true },
      { name: "航運", pct: "-0.88%", up: false },
      { name: "金融", pct: "+0.45%", up: true },
      { name: "電子上游", pct: "+1.20%", up: true },
      { name: "電子中游", pct: "-0.32%", up: false },
      { name: "傳產", pct: "+0.67%", up: true },
    ]);
  }
}
