"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PortfolioItem } from "@/types/stock";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#84cc16"];

interface Props {
  items: PortfolioItem[];
}

export default function PortfolioChart({ items }: Props) {
  const totalValue = items.reduce((s, i) => s + i.marketValue, 0);
  const totalPnl = items.reduce((s, i) => s + i.pnl, 0);
  const data = items.map((i) => ({ name: i.name || i.symbol, value: i.marketValue }));

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
        設定持股成本後顯示損益
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-6 mb-4">
        <div>
          <div className="text-xs text-gray-500">總市值</div>
          <div className="text-xl font-bold text-white">
            {totalValue.toLocaleString()} 元
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">總損益</div>
          <div className={`text-xl font-bold ${totalPnl >= 0 ? "text-red-400" : "text-green-400"}`}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString()} 元
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={false} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString()} 元`, "市值"]}
            contentStyle={{ background: "#1a1d2e", border: "1px solid #2d3148" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
