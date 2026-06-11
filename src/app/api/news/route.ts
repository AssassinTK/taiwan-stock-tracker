import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";

export const revalidate = 300;

export async function GET() {
  const news = await fetchNews();
  return NextResponse.json(news);
}
