import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json([], { status: 502 });
    const data: Record<string, string>[] = await res.json();

    const targets = [
      { key: "加權股價指數", label: "加權指數" },
      { key: "未含金融保險股指數", label: "不含金融" },
      { key: "電子類指數", label: "電子類" },
      { key: "金融保險類指數", label: "金融類" },
    ];

    const rows = targets.map(({ key, label }) => {
      const row = data.find((d) => d["指數名稱"] === key);
      if (!row) return null;
      const pct = parseFloat(row["漲跌百分比"] ?? "0");
      const chg = parseFloat(row["漲跌點數"] ?? "0");
      return {
        name: label,
        value: row["收盤指數"] ?? row["最新指數"] ?? "—",
        change: chg >= 0 ? `+${chg.toFixed(2)}` : chg.toFixed(2),
        pct: pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`,
        up: pct >= 0,
      };
    }).filter(Boolean);

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
