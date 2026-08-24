/**
 * SmartBuyingAssistant — Price analysis popup.
 *
 * Triggered by a button on ProductDetailPage.
 * Fetches /api/products/:id/insights and renders:
 *  • Verdict badge (ควรซื้อ / รอโปร / รอราคาลง / ราคาปกติ)
 *  • Statistical grid (avg, vs-avg, trend, prediction)
 *  • Sparkline of the last 20 price history snapshots
 *  • Natural-language summary + tip
 */

import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../../api";
import type { PriceInsight, PriceTrend } from "../../types";
import {
  X, TrendingDown, TrendingUp, Minus,
  Brain, RefreshCw, Calendar, BarChart2,
  Target, Lightbulb,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("th-TH");
}

function signedPct(pct: number): string {
  return pct < 0 ? `${pct}%` : `+${pct}%`;
}

const VERDICT_STYLE: Record<
  string,
  { bg: string; border: string; text: string; badge: string; badgeText: string }
> = {
  buy: {
    bg: "bg-green-50", border: "border-green-200",
    text: "text-green-800", badge: "bg-green-500", badgeText: "text-white",
  },
  wait_sale: {
    bg: "bg-blue-50", border: "border-blue-200",
    text: "text-blue-800", badge: "bg-blue-500", badgeText: "text-white",
  },
  wait_drop: {
    bg: "bg-amber-50", border: "border-amber-200",
    text: "text-amber-800", badge: "bg-amber-500", badgeText: "text-white",
  },
  watch: {
    bg: "bg-gray-50", border: "border-gray-200",
    text: "text-gray-700", badge: "bg-gray-400", badgeText: "text-white",
  },
};

const TREND_CONFIG: Record<PriceTrend, { icon: typeof TrendingDown; color: string; label: string }> = {
  dropping: { icon: TrendingDown, color: "text-green-600", label: "ลดลง"     },
  rising:   { icon: TrendingUp,   color: "text-red-500",   label: "เพิ่มขึ้น" },
  stable:   { icon: Minus,        color: "text-gray-400",  label: "ทรงตัว"   },
};

// ── Sparkline (SVG) ───────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 200, H = 48, PAD = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // Gradient fill
  const fillD = `${d} L${pts[pts.length - 1].x},${H - PAD} L${pts[0].x},${H - PAD} Z`;
  const isDown = pts[pts.length - 1].y < pts[0].y; // lower y = higher price on screen; flipped for chart
  const color  = isDown ? "#10b981" : "#f59e0b";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({
  label, value, sub, icon: Icon, color = "text-gray-900",
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className="text-gray-400" />
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Confidence pill ───────────────────────────────────────────────────────────

function ConfidencePill({ level }: { level: "high" | "medium" | "low" }) {
  const cfg = {
    high:   { label: "ความแม่นยำสูง",      cls: "bg-green-100 text-green-700" },
    medium: { label: "ความแม่นยำปานกลาง", cls: "bg-amber-100 text-amber-700"  },
    low:    { label: "ข้อมูลยังน้อย",       cls: "bg-gray-100 text-gray-500"   },
  }[level];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Main modal component ──────────────────────────────────────────────────────

interface Props {
  productId:    string;
  productName:  string;
  priceHistory: Array<{ date: string; minPrice: number }>;
  onClose:      () => void;
}

export default function SmartBuyingAssistant({ productId, productName, priceHistory, onClose }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["insights", productId],
    queryFn:  () => productsApi.getInsights(productId),
    staleTime: 30 * 60 * 1000,  // 30 min cache
  });

  const insight: PriceInsight | undefined = data?.data;
  const style = insight ? VERDICT_STYLE[insight.verdict] : VERDICT_STYLE.watch;
  const trendCfg = insight ? TREND_CONFIG[insight.trend] : null;

  // Sparkline data: last 20 snapshots
  const sparkData = priceHistory
    .slice(-20)
    .map((s) => s.minPrice)
    .filter((v) => v > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Smart Buying Assistant</p>
              <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{productName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw size={15} />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {isLoading && (
            <div className="space-y-4">
              <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">วิเคราะห์ไม่สำเร็จ — กรุณาลองใหม่</p>
              <button onClick={() => refetch()} className="mt-2 text-blue-500 text-xs hover:underline">
                ลองใหม่
              </button>
            </div>
          )}

          {insight && insight.dataPoints >= 2 && (
            <>
              {/* ── Verdict banner ──────────────────────────────────────── */}
              <div className={`rounded-2xl border p-4 ${style.bg} ${style.border}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold px-3 py-1.5 rounded-xl ${style.badge} ${style.badgeText} text-2xl`}>
                    {insight.verdictEmoji}
                  </span>
                  <div className="flex-1">
                    <p className={`font-extrabold text-xl leading-none mb-1 ${style.text}`}>
                      {insight.verdictLabel}
                    </p>
                    <p className={`text-sm leading-snug ${style.text} opacity-80`}>
                      {insight.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Stat grid ───────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="ราคาตอนนี้"
                  value={`฿${fmt(insight.currentPrice)}`}
                  icon={Target}
                  color="text-blue-700"
                />
                <Stat
                  label="เทียบค่าเฉลี่ย 30 วัน"
                  value={insight.vsAvg30dPct !== null ? signedPct(insight.vsAvg30dPct) : "—"}
                  sub={insight.avg30d ? `เฉลี่ย ฿${fmt(insight.avg30d)}` : "ข้อมูลไม่พอ"}
                  icon={BarChart2}
                  color={
                    insight.vsAvg30dPct === null ? "text-gray-500" :
                    insight.vsAvg30dPct <= -5    ? "text-green-600" :
                    insight.vsAvg30dPct >= 8     ? "text-red-500"   :
                    "text-gray-700"
                  }
                />
                <Stat
                  label="แนวโน้ม 14 วัน"
                  value={trendCfg?.label ?? "—"}
                  sub={insight.trendPct14d !== 0 ? `${signedPct(insight.trendPct14d)} ใน 14 วัน` : "ทรงตัว"}
                  icon={trendCfg?.icon ?? Minus}
                  color={trendCfg?.color ?? "text-gray-500"}
                />
                <Stat
                  label="คาดการณ์ 14 วัน"
                  value={insight.predicted14d ? `฿${fmt(insight.predicted14d)}` : "—"}
                  sub={
                    insight.predicted14d
                      ? `${insight.predicted14d < insight.currentPrice ? "↓" : "↑"} ฿${fmt(Math.abs(insight.predicted14d - insight.currentPrice))}`
                      : "ข้อมูลไม่พอ"
                  }
                  icon={TrendingDown}
                  color={
                    !insight.predicted14d ? "text-gray-400" :
                    insight.predicted14d < insight.currentPrice ? "text-green-600" :
                    "text-red-500"
                  }
                />
              </div>

              {/* ── Sparkline ───────────────────────────────────────────── */}
              {sparkData.length >= 3 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500">ราคาย้อนหลัง (สูงสุด 20 ครั้ง)</p>
                    <ConfidencePill level={insight.confidence} />
                  </div>
                  <Sparkline data={sparkData} />
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>นานที่สุด</span>
                    <span>ล่าสุด</span>
                  </div>
                  {(insight.allTimeMin || insight.allTimeMax) && (
                    <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
                      {insight.allTimeMin && <span>ต่ำสุดตลอดกาล: <strong className="text-green-600">฿{fmt(insight.allTimeMin)}</strong></span>}
                      {insight.allTimeMax && <span>สูงสุดตลอดกาล: <strong className="text-red-500">฿{fmt(insight.allTimeMax)}</strong></span>}
                    </div>
                  )}
                </div>
              )}

              {/* ── Next sale event ──────────────────────────────────────── */}
              {insight.nextSaleEvent && (
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                  <Calendar size={18} className="text-purple-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-900">
                      โปร {insight.nextSaleEvent.name} อีก {insight.nextSaleEvent.daysUntil} วัน
                    </p>
                    <p className="text-xs text-purple-600">
                      {insight.nextSaleEvent.daysUntil <= 7
                        ? "ใกล้มากแล้ว! มักมีส่วนลด 10–25%"
                        : insight.nextSaleEvent.daysUntil <= 21
                        ? "อาจคุ้มค่ารอ — ขึ้นอยู่กับความเร่งด่วน"
                        : "ยังมีเวลา ติดตามราคาต่อไปก่อน"}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Details + Tip ────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <BarChart2 size={12} /> การวิเคราะห์
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{insight.details}</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1.5">
                    <Lightbulb size={12} /> คำแนะนำ
                  </p>
                  <p className="text-sm text-blue-800 leading-relaxed font-medium">{insight.tip}</p>
                </div>
              </div>

              {/* ── Footer ──────────────────────────────────────────────── */}
              <p className="text-[10px] text-gray-300 text-center pb-1">
                วิเคราะห์จาก {insight.dataPoints} ข้อมูลราคา
                · อัพเดทล่าสุด {new Date(insight.analysedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                · ผลการวิเคราะห์เป็นเพียงแนวทางเท่านั้น
              </p>
            </>
          )}

          {/* No data state — fewer than 2 history points */}
          {!isLoading && !error && insight && insight.dataPoints < 2 && (
            <div className="text-center py-8 text-gray-400 text-sm space-y-3">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                <Brain size={28} className="text-gray-300" />
              </div>
              <div>
                <p className="font-semibold text-gray-500">ข้อมูลราคายังไม่เพียงพอ</p>
                <p className="text-xs mt-1 text-gray-400">ระบบต้องการข้อมูลราคาอย่างน้อย 3 ครั้ง<br/>เพื่อวิเคราะห์แนวโน้มและทำนายราคาได้</p>
              </div>
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-left">
                <p className="text-xs text-blue-700 font-medium">💡 ลอง scrape ราคาสินค้านี้อีกสักระยะ</p>
                <p className="text-xs text-blue-600 mt-0.5">ระบบจะเก็บ snapshot ราคาทุกครั้งที่ scrape</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
