import { NewsItem } from "@/types/stock";

const SECTOR_KEYWORDS: Record<string, string[]> = {
  "AI/半導體": ["台積電", "聯發科", "輝達", "NVIDIA", "半導體", "晶片", "AI", "人工智慧", "IC設計"],
  "匯率/美元": ["美元", "台幣", "匯率", "升息", "降息", "聯準會", "Fed", "外匯"],
  "航運/油價": ["航運", "長榮", "陽明", "萬海", "油價", "原油", "運費"],
  "銀行/金融": ["銀行", "升息", "降息", "金融股", "壽險", "利率"],
  "地緣政治": ["台海", "中美", "貿易戰", "關稅", "制裁", "地緣"],
  "科技/電子": ["蘋果", "Apple", "Google", "Meta", "電子股", "鴻海", "廣達"],
};

function detectSectors(text: string): string[] {
  return Object.entries(SECTOR_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => text.includes(k)))
    .map(([sector]) => sector);
}

// Finnhub free tier news (English + TW coverage)
export async function fetchNews(): Promise<NewsItem[]> {
  const categories = ["general", "forex", "crypto"];
  const items: NewsItem[] = [];

  try {
    for (const cat of categories) {
      const finnhubKey = process.env.FINNHUB_API_KEY;
      if (!finnhubKey) continue;
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=${cat}&token=${finnhubKey}`,
        { next: { revalidate: 300 } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const slice = (data as Array<{
        id: number | string;
        headline: string;
        summary: string;
        url: string;
        datetime: number;
        source: string;
      }>).slice(0, 5);
      for (const n of slice) {
        const text = `${n.headline} ${n.summary}`;
        items.push({
          id: String(n.id),
          title: n.headline,
          summary: n.summary,
          url: n.url,
          publishedAt: new Date(n.datetime * 1000).toISOString(),
          source: n.source,
          sectors: detectSectors(text),
        });
      }
    }
  } catch {
    // return empty on failure
  }

  // dedupe by id
  const seen = new Set<string>();
  return items.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}
