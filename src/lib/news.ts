import { NewsItem } from "@/types/stock";

const SECTOR_KEYWORDS: Record<string, string[]> = {
  "AI/半導體": ["台積電", "聯發科", "輝達", "NVIDIA", "半導體", "晶片", "AI", "人工智慧", "IC設計", "先進封裝"],
  "匯率/美元": ["美元", "台幣", "匯率", "升息", "降息", "聯準會", "Fed", "外匯", "央行"],
  "航運/油價": ["航運", "長榮", "陽明", "萬海", "油價", "原油", "運費", "散裝"],
  "銀行/金融": ["銀行", "金融股", "壽險", "利率", "存款", "股息", "ETF"],
  "地緣政治": ["台海", "中美", "貿易戰", "關稅", "制裁", "地緣", "兩岸"],
  "科技/電子": ["蘋果", "Apple", "Google", "Meta", "電子股", "鴻海", "廣達", "緯創", "伺服器"],
  "消費/零售": ["統一", "全家", "寶雅", "消費", "零售", "百貨"],
};

function detectSectors(text: string): string[] {
  return Object.entries(SECTOR_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => text.includes(k)))
    .map(([sector]) => sector);
}

async function fetchYahooRSS(): Promise<NewsItem[]> {
  const res = await fetch("https://tw.stock.yahoo.com/rss", {
    next: { revalidate: 300 },
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return [];
  const xml = await res.text();

  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let idx = 0;

  while ((match = itemRegex.exec(xml)) !== null && idx < 20) {
    const block = match[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1] ?? "";
    const link = (/<link>(.*?)<\/link>/.exec(block))?.[1] ?? "";
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1] ?? "";
    const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ?? /<description>(.*?)<\/description>/.exec(block))?.[1] ?? "";

    if (!title || !link) continue;
    const text = `${title} ${desc}`;
    items.push({
      id: `yahoo-${idx}`,
      title,
      summary: desc.replace(/<[^>]+>/g, "").slice(0, 120),
      url: link,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      source: "Yahoo股市",
      sectors: detectSectors(text),
    });
    idx++;
  }
  return items;
}

async function fetchCnyesRSS(): Promise<NewsItem[]> {
  const feeds = [
    "https://feeds.cnyes.com/news/cat/twstock.xml",
    "https://feeds.cnyes.com/news/cat/intl.xml",
  ];
  const items: NewsItem[] = [];

  for (const url of feeds) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 300 },
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let idx = 0;
      while ((match = itemRegex.exec(xml)) !== null && idx < 10) {
        const block = match[1];
        const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1] ?? "";
        const link = (/<link>(.*?)<\/link>/.exec(block))?.[1]?.trim() ?? "";
        const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1] ?? "";
        const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ?? /<description>(.*?)<\/description>/.exec(block))?.[1] ?? "";
        if (!title) continue;
        const text = `${title} ${desc}`;
        items.push({
          id: `cnyes-${items.length}`,
          title,
          summary: desc.replace(/<[^>]+>/g, "").slice(0, 120),
          url: link,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          source: "鉅亨網",
          sectors: detectSectors(text),
        });
        idx++;
      }
    } catch { /* skip */ }
  }
  return items;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const [yahoo, cnyes] = await Promise.allSettled([fetchYahooRSS(), fetchCnyesRSS()]);

  const all: NewsItem[] = [
    ...(yahoo.status === "fulfilled" ? yahoo.value : []),
    ...(cnyes.status === "fulfilled" ? cnyes.value : []),
  ];

  // sort by date desc, dedupe by title
  const seen = new Set<string>();
  return all
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .filter((n) => {
      if (seen.has(n.title)) return false;
      seen.add(n.title);
      return true;
    });
}
