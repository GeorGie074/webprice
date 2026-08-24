import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { productsApi } from "../../api";
import { PLATFORM_COLORS } from "../../types";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Props { productId: string }

const RANGE_OPTIONS = [
  { label: "7 วัน",  days: 7  },
  { label: "30 วัน", days: 30 },
  { label: "90 วัน", days: 90 },
] as const;

function fmtPrice(v: number) {
  if (v >= 1000) return `฿${(v / 1000).toFixed(1)}K`;
  return `฿${v}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ── Custom tooltip ─────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-2xl px-3.5 py-2.5 text-xs min-w-[140px]">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {[...payload]
        .sort((a: any, b: any) => a.value - b.value)
        .map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-gray-500 flex-1">{entry.dataKey}</span>
            <span className="font-bold text-gray-900">฿{Number(entry.value).toLocaleString()}</span>
          </div>
        ))}
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = "gray" }: {
  label: string; value: string; sub?: string;
  color?: "gray" | "emerald" | "red" | "blue";
}) {
  const colors = {
    gray:    "bg-gray-50  border-gray-100  text-gray-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    red:     "bg-red-50   border-red-100   text-red-600",
    blue:    "bg-blue-50  border-blue-100  text-blue-700",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${colors[color]}`}>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold leading-tight ${colors[color].split("  ")[2]}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Main chart component ───────────────────────────────────────────────── */
export function PriceHistoryChart({ productId }: Props) {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["priceHistory", productId, days],
    queryFn: () => productsApi.getHistory(productId, days),
    staleTime: 5 * 60_000,
  });

  const history: any[] = data?.data?.history ?? [];

  const allPlatforms = [...new Set(
    history.flatMap((s: any) => s.platforms.map((p: any) => p.platform))
  )].sort();

  const chartData = history.map((s: any) => {
    const row: Record<string, any> = { date: fmtDate(s.date) };
    s.platforms.forEach((p: any) => { row[p.platform] = p.price; });
    return row;
  });

  // ── Compute stats ────────────────────────────────────────────────────
  const allMinPrices = history.map((s: any) => s.minPrice).filter(Boolean);
  const atl      = allMinPrices.length ? Math.min(...allMinPrices) : null;
  const ath      = allMinPrices.length ? Math.max(...allMinPrices) : null;
  const avg      = allMinPrices.length ? Math.round(allMinPrices.reduce((a, b) => a + b, 0) / allMinPrices.length) : null;
  const first    = allMinPrices[0]  ?? null;
  const last     = allMinPrices[allMinPrices.length - 1] ?? null;
  const changePct = first && last ? Math.round(((last - first) / first) * 100) : null;
  const trendUp   = changePct !== null && changePct > 0;
  const trendDown = changePct !== null && changePct < 0;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="card overflow-hidden animate-pulse">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="h-5 bg-gray-100 rounded w-40" />
        </div>
        <div className="px-6 py-5 grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-2xl" />)}
        </div>
        <div className="px-6 pb-6">
          <div className="h-52 bg-gray-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  const hasData = chartData.length >= 2;

  return (
    <div className="card overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown size={18} className="text-blue-500" />
          <h2 className="font-bold text-gray-900">ประวัติราคา</h2>
          {changePct !== null && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
              trendDown ? "bg-emerald-100 text-emerald-600"
              : trendUp  ? "bg-red-100 text-red-500"
              : "bg-gray-100 text-gray-500"
            }`}>
              {trendDown ? <TrendingDown size={11} /> : trendUp ? <TrendingUp size={11} /> : <Minus size={11} />}
              {Math.abs(changePct)}%
            </span>
          )}
        </div>

        {/* Range selector */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-medium">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days as any)}
              className={`px-3 py-1.5 transition-colors ${
                days === opt.days ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      {hasData && (
        <div className="px-6 pt-5 pb-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="ราคาต่ำสุดตลอดกาล"
            value={atl ? `฿${atl.toLocaleString()}` : "—"}
            color="emerald"
          />
          <StatCard
            label="ราคาสูงสุดในช่วงนี้"
            value={ath ? `฿${ath.toLocaleString()}` : "—"}
            color="red"
          />
          <StatCard
            label="ราคาเฉลี่ย"
            value={avg ? `฿${avg.toLocaleString()}` : "—"}
            color="blue"
          />
          <StatCard
            label={`เปลี่ยนแปลง ${days} วัน`}
            value={changePct !== null ? `${changePct > 0 ? "+" : ""}${changePct}%` : "—"}
            sub={first && last ? `฿${first.toLocaleString()} → ฿${last.toLocaleString()}` : undefined}
            color={trendDown ? "emerald" : trendUp ? "red" : "gray"}
          />
        </div>
      )}

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-44 text-gray-400 gap-2">
            <TrendingDown size={32} className="text-gray-200" />
            <p className="text-sm font-medium">ยังไม่มีข้อมูลประวัติราคา</p>
            <p className="text-xs text-gray-300">จะเริ่มเก็บข้อมูลหลังจาก scrape ครั้งถัดไป</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {allPlatforms.map((platform) => {
                  const color = PLATFORM_COLORS[platform] || "#6b7280";
                  const id = `grad-${platform.replace(/\W+/g, "")}`;
                  return (
                    <linearGradient key={platform} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={color} stopOpacity={0}    />
                    </linearGradient>
                  );
                })}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tickFormatter={fmtPrice}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false} tickLine={false}
                width={54}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              />

              {allPlatforms.map((platform) => {
                const color = PLATFORM_COLORS[platform] || "#6b7280";
                const id = `grad-${platform.replace(/\W+/g, "")}`;
                return (
                  <Area
                    key={platform}
                    type="monotone"
                    dataKey={platform}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${id})`}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {hasData && (
        <p className="px-6 pb-4 text-xs text-gray-300">อัปเดตทุกครั้งที่มีการ scrape ราคา</p>
      )}
    </div>
  );
}
