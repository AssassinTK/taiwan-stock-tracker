export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  limitUp: number;
  limitDown: number;
  updatedAt: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  cost?: number;
  shares?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
  sectors: string[];
}

export interface PortfolioItem extends WatchlistItem {
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}
