"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries } from "lightweight-charts";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  symbol: string;
}

export default function StockChart({ symbol }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!chartRef.current || !volRef.current) return;

    const chartEl = chartRef.current;
    const volEl = volRef.current;

    const chart = createChart(chartEl, {
      layout: { background: { color: "#1a1a1a" }, textColor: "#aaa" },
      grid: { vertLines: { color: "#222" }, horzLines: { color: "#222" } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#333" },
      timeScale: { borderColor: "#333", timeVisible: true },
      width: chartEl.clientWidth,
      height: chartEl.clientHeight,
    });

    const volChart = createChart(volEl, {
      layout: { background: { color: "#1a1a1a" }, textColor: "#888" },
      grid: { vertLines: { color: "#222" }, horzLines: { color: "transparent" } },
      rightPriceScale: { borderColor: "#333", scaleMargins: { top: 0.1, bottom: 0 } },
      timeScale: { borderColor: "#333", timeVisible: false, visible: false },
      width: volEl.clientWidth,
      height: volEl.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#e74c3c",
      downColor: "#2ecc71",
      borderUpColor: "#e74c3c",
      borderDownColor: "#2ecc71",
      wickUpColor: "#e74c3c",
      wickDownColor: "#2ecc71",
    });

    const volSeries = volChart.addSeries(HistogramSeries, {
      color: "#555",
      priceFormat: { type: "volume" },
    });

    let destroyed = false;

    fetch(`/api/chart?symbol=${symbol}&range=3mo`)
      .then((r) => r.json())
      .then((data: { candles?: Candle[]; error?: string }) => {
        if (destroyed) return;
        if (!data.candles?.length) { setError("無法載入圖表資料"); setLoading(false); return; }

        const sorted = [...data.candles].sort((a, b) => a.time - b.time);

        candleSeries.setData(sorted.map((c) => ({
          time: c.time as unknown as import("lightweight-charts").Time,
          open: c.open, high: c.high, low: c.low, close: c.close,
        })));

        volSeries.setData(sorted.map((c) => ({
          time: c.time as unknown as import("lightweight-charts").Time,
          value: c.volume,
          color: c.close >= c.open ? "#c0392b55" : "#27ae6055",
        })));

        chart.timeScale().fitContent();
        volChart.timeScale().fitContent();

        // sync crosshair
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          volChart.timeScale().setVisibleRange(chart.timeScale().getVisibleRange()!);
        });

        setLoading(false);
      })
      .catch(() => { if (!destroyed) { setError("資料載入失敗"); setLoading(false); } });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: chartEl.clientWidth, height: chartEl.clientHeight });
      volChart.applyOptions({ width: volEl.clientWidth, height: volEl.clientHeight });
    });
    ro.observe(chartEl);
    ro.observe(volEl);

    return () => {
      destroyed = true;
      ro.disconnect();
      chart.remove();
      volChart.remove();
    };
  }, [symbol]);

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] rounded-xl overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1a1a1a]">
          <div className="text-gray-500 text-sm">載入中...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1a1a1a]">
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      )}
      <div className="relative flex-1">
        <div ref={chartRef} className="w-full h-full" />
      </div>
      <div className="h-[80px]">
        <div ref={volRef} className="w-full h-full" />
      </div>
    </div>
  );
}
