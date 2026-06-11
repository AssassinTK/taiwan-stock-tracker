import { NextResponse } from "next/server";

const SECTOR_MAP: { key: string; label: string; category: string }[] = [
  { key: "半導體類指數", label: "半導體", category: "電子上游" },
  { key: "電子零組件類指數", label: "電子零組件", category: "電子上游" },
  { key: "光電類指數", label: "光電", category: "電子上游" },
  { key: "通信網路類指數", label: "通信網路", category: "電子中游" },
  { key: "電腦及週邊設備類指數", label: "電腦周邊", category: "電子下游" },
  { key: "電子通路類指數", label: "電子通路", category: "電子下游" },
  { key: "電子類指數", label: "電子綜合", category: "電子" },
  { key: "資訊服務類指數", label: "資訊服務", category: "電子" },
  { key: "金融保險類指數", label: "金融保險", category: "金融" },
  { key: "航運業類指數", label: "航運", category: "傳產" },
  { key: "鋼鐵類指數", label: "鋼鐵", category: "傳產" },
  { key: "塑膠類指數", label: "塑膠", category: "傳產" },
  { key: "化學生技醫療類指數", label: "生技醫療", category: "生技" },
  { key: "建材營造類指數", label: "建材營造", category: "建設" },
  { key: "觀光餐旅類指數", label: "觀光餐旅", category: "服務" },
  { key: "食品類指數", label: "食品", category: "傳產" },
];

const FALLBACK = [
  { name: "半導體", pct: "—", up: null, category: "電子上游" },
  { name: "金融保險", pct: "—", up: null, category: "金融" },
  { name: "航運", pct: "—", up: null, category: "傳產" },
  { name: "生技醫療", pct: "—", up: null, category: "生技" },
  { name: "電子零組件", pct: "—", up: null, category: "電子上游" },
  { name: "電腦周邊", pct: "—", up: null, category: "電子下游" },
];

export async function GET() {
  try {
    const res = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 180 },
    });
    if (!res.ok) return NextResponse.json(FALLBACK);
    const data: Record<string, string>[] = await res.json();

    const sectors = SECTOR_MAP.map(({ key, label, category }) => {
      const row = data.find((d) => d["指數名稱"] === key);
      if (!row) return null;
      const pct = parseFloat(row["漲跌百分比"] ?? "0");
      return {
        name: label,
        pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
        up: pct >= 0,
        category,
      };
    }).filter(Boolean);

    if (sectors.length === 0) return NextResponse.json(FALLBACK);
    return NextResponse.json(sectors);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
