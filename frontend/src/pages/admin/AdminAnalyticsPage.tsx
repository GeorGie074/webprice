import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { proxyImage } from "../../utils/imageUrl";
import {
  TrendingUp, Search, Package, BarChart3,
  ShoppingBag, Tag,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  trend:        { date: string; count: number }[];
  topKeywords:  { query: string; count: number }[];
  categoryDist: { category: string; count: number }[];
  priceBuckets: { label: string; count: number }[];
  topProducts:  { _id: string; nameTh: string; brand: string; minPrice: number; category: string; image: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  smartphone: { label: "สมาร์ทโฟน",   emoji: "📱", color: "bg-blue-500"   },
  laptop:     { label: "โน้ตบุ๊ค",     emoji: "💻", color: "bg-indigo-500" },
  tablet:     { label: "แท็บเล็ต",     emoji: "📟", color: "bg-violet-500" },
  audio:      { label: "เสียง",         emoji: "🎧", color: "bg-purple-500" },
  home:       { label: "ของใช้บ้าน",   emoji: "🏠", color: "bg-teal-500"   },
  fashion:    { label: "แฟชั่น",       emoji: "👟", color: "bg-pink-500"   },
  beauty:     { label: "ความงาม",      emoji: "💄", color: "bg-rose-500"   },
  health:     { label: "สุขภาพ",       emoji: "🏥", color: "bg-green-500"  },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function BarChart({
  data, valueKey, labelKey, colorClass = "bg-blue-500",
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  colorClass?: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = Number(item[valueKey]);
        const pct = Math.round((val / max) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-28 truncate shrink-0 text-right">
              {String(item[labelKey])}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${colorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600 w-8 text-right shrink-0">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.analytics(),
    staleTime: 60_000,
  });

  const analytics: AnalyticsData = data?.data ?? {
    trend: [], topKeywords: [], categoryDist: [], priceBuckets: [], topProducts: [],
  };

  const totalSearches = analytics.trend.reduce((s, d) => s + d.count, 0);
  const maxTrend = Math.max(...analytics.trend.map((d) => d.count), 1);
  const totalProducts = analytics.categoryDist.reduce((s, c) => s + c.count, 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-xl w-48" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">ข้อมูลการค้นหาและสินค้าใน 7 วันที่ผ่านมา</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Search size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ค้นหา 7 วัน</p>
              <p className="text-2xl font-extrabold text-gray-900">{totalSearches.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            เฉลี่ย {Math.round(totalSearches / 7)} ครั้ง/วัน
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Package size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">สินค้าทั้งหมด</p>
              <p className="text-2xl font-extrabold text-gray-900">{totalProducts.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{analytics.categoryDist.length} หมวดหมู่</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <TrendingUp size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">คำค้นหายอดนิยม</p>
              <p className="text-lg font-extrabold text-gray-900 truncate">
                {analytics.topKeywords[0]?.query ?? "—"}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {analytics.topKeywords[0]?.count ?? 0} ครั้ง (อันดับ 1)
          </p>
        </div>
      </div>

      {/* Search trend chart */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={16} className="text-blue-500" />
          <h3 className="font-semibold text-gray-900">การค้นหา 7 วันล่าสุด</h3>
        </div>
        {analytics.trend.every((d) => d.count === 0) ? (
          <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีข้อมูลการค้นหา</div>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {analytics.trend.map((day) => {
              const h = Math.max(Math.round((day.count / maxTrend) * 100), 4);
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-600">{day.count || ""}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      isToday ? "bg-blue-500" : "bg-blue-200"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                  <span className={`text-[10px] ${isToday ? "font-bold text-blue-600" : "text-gray-400"}`}>
                    {formatDate(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top keywords */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search size={16} className="text-teal-500" />
            <h3 className="font-semibold text-gray-900">คำค้นหายอดนิยม</h3>
          </div>
          {analytics.topKeywords.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-2.5">
              {analytics.topKeywords.map((kw, i) => {
                const max = analytics.topKeywords[0].count;
                const pct = Math.round((kw.count / max) * 100);
                return (
                  <div key={kw.query} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-5 text-center ${
                      i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"
                    }`}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700 truncate">{kw.query}</span>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">{kw.count} ครั้ง</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category distribution */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={16} className="text-purple-500" />
            <h3 className="font-semibold text-gray-900">สินค้าแต่ละหมวดหมู่</h3>
          </div>
          {analytics.categoryDist.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีสินค้า</div>
          ) : (
            <div className="space-y-2.5">
              {analytics.categoryDist.map((cat) => {
                const info = CATEGORY_LABEL[cat.category] ?? { label: cat.category, emoji: "📦", color: "bg-gray-400" };
                const pct = Math.round((cat.count / totalProducts) * 100);
                return (
                  <div key={cat.category} className="flex items-center gap-2.5">
                    <span className="text-sm w-5 text-center shrink-0">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700">{info.label}</span>
                        <span className="text-xs text-gray-400">{cat.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${info.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Price range distribution */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={16} className="text-rose-500" />
            <h3 className="font-semibold text-gray-900">ช่วงราคาสินค้า</h3>
          </div>
          {analytics.priceBuckets.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <BarChart
              data={analytics.priceBuckets}
              valueKey="count"
              labelKey="label"
              colorClass="bg-rose-400"
            />
          )}
        </div>

        {/* Top products */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={16} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-900">สินค้าราคาสูงสุด</h3>
          </div>
          <div className="space-y-3">
            {analytics.topProducts.map((p) => {
              const info = CATEGORY_LABEL[p.category] ?? { emoji: "📦" };
              return (
                <div key={p._id} className="flex items-center gap-3">
                  <img
                    src={proxyImage(p.image)}
                    alt={p.nameTh}
                    className="w-9 h-9 object-contain rounded-lg bg-gray-50 border border-gray-100 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{p.nameTh}</p>
                    <p className="text-xs text-gray-400">{info.emoji} {p.brand}</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600 shrink-0">฿{p.minPrice.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
