/**
 * priceAnalysis.ts — Rule-based Smart Buying Assistant engine.
 *
 * No external API needed. Uses only:
 *  • Price history snapshots already stored in MongoDB
 *  • A calendar of Thai + international sale events
 *  • Linear regression for trend + prediction
 *
 * Outputs a fully structured PriceInsight object ready for the frontend.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Verdict = "buy" | "wait_sale" | "wait_drop" | "watch";
export type Trend   = "dropping" | "rising" | "stable";
export type Confidence = "high" | "medium" | "low";

export interface PriceInsight {
  // Raw numbers
  currentPrice:    number;
  avg30d:          number | null;  // null = not enough history
  avg60d:          number | null;
  allTimeMin:      number | null;
  allTimeMax:      number | null;
  vsAvg30dPct:     number | null;  // negative = below average (good for buyer)

  // Trend (last 14 days or all available)
  trend:           Trend;
  trendPct14d:     number;         // % change over last 14 days

  // Prediction
  predicted14d:    number | null;
  predicted30d:    number | null;
  confidence:      Confidence;

  // Next sale event within 60 days
  nextSaleEvent:   { name: string; daysUntil: number } | null;

  // Decision
  verdict:         Verdict;
  verdictLabel:    string;   // Thai label
  verdictEmoji:    string;

  // Natural-language insight (Thai, template-based)
  summary:         string;   // 1 sentence headline
  details:         string;   // 2-3 sentences detail
  tip:             string;   // actionable advice

  // Meta
  dataPoints:      number;
  analysedAt:      string;   // ISO timestamp
}

// ─── Sale events calendar ─────────────────────────────────────────────────────

interface SaleEvent {
  name: string;
  month: number;  // 1-based
  day:   number;
}

const SALE_EVENTS: SaleEvent[] = [
  { name: "1.1",          month: 1,  day: 1  },
  { name: "2.2",          month: 2,  day: 2  },
  { name: "3.3",          month: 3,  day: 3  },
  { name: "สงกรานต์",     month: 4,  day: 11 },
  { name: "4.4",          month: 4,  day: 4  },
  { name: "5.5",          month: 5,  day: 5  },
  { name: "6.6",          month: 6,  day: 6  },
  { name: "7.7",          month: 7,  day: 7  },
  { name: "8.8",          month: 8,  day: 8  },
  { name: "9.9",          month: 9,  day: 9  },
  { name: "10.10",        month: 10, day: 10 },
  { name: "11.11",        month: 11, day: 11 },
  { name: "Black Friday", month: 11, day: 29 },
  { name: "12.12",        month: 12, day: 12 },
  { name: "คริสต์มาส",   month: 12, day: 25 },
];

/** Days until a specific month/day event (looks ahead up to 365 days) */
function daysUntilEvent(month: number, day: number, now: Date = new Date()): number {
  const thisYear  = now.getFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  if (candidate.getTime() <= now.getTime()) {
    // Already passed this year — check next year
    candidate.setFullYear(thisYear + 1);
  }
  return Math.ceil((candidate.getTime() - now.getTime()) / 86_400_000);
}

function nextSaleEvent(maxDays = 60): { name: string; daysUntil: number } | null {
  const now = new Date();
  let best: { name: string; daysUntil: number } | null = null;
  for (const ev of SALE_EVENTS) {
    const d = daysUntilEvent(ev.month, ev.day, now);
    if (d <= maxDays && (best === null || d < best.daysUntil)) {
      best = { name: ev.name, daysUntil: d };
    }
  }
  return best;
}

// ─── Linear regression helpers ────────────────────────────────────────────────

/** Simple OLS for { x: days, y: price } */
function linearRegression(pts: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const sumX  = pts.reduce((s, p) => s + p.x,       0);
  const sumY  = pts.reduce((s, p) => s + p.y,       0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Rolling average of last N snapshots */
function rollingAvg(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface Snapshot { date: Date; minPrice: number }

export function analyzePriceHistory(
  history: Snapshot[],
  currentPrice: number
): PriceInsight {
  const now       = new Date();
  const sorted    = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const dataPoints = sorted.length;

  // ── Average calculations ─────────────────────────────────────────────────
  const cutoff30 = new Date(now.getTime() - 30 * 86_400_000);
  const cutoff60 = new Date(now.getTime() - 60 * 86_400_000);

  const prices30 = sorted.filter((s) => s.date >= cutoff30).map((s) => s.minPrice);
  const prices60 = sorted.filter((s) => s.date >= cutoff60).map((s) => s.minPrice);
  const allPrices = sorted.map((s) => s.minPrice);

  const avg30d    = prices30.length >= 2  ? rollingAvg(prices30) : null;
  const avg60d    = prices60.length >= 3  ? rollingAvg(prices60) : null;
  const allTimeMin = allPrices.length > 0 ? Math.min(...allPrices) : null;
  const allTimeMax = allPrices.length > 0 ? Math.max(...allPrices) : null;

  const vsAvg30dPct = avg30d
    ? Math.round(((currentPrice - avg30d) / avg30d) * 1000) / 10  // 1 decimal
    : null;

  // ── Trend (last 14 days or all available, min 3 points) ─────────────────
  const cutoff14 = new Date(now.getTime() - 14 * 86_400_000);
  const window14 = sorted.filter((s) => s.date >= cutoff14);
  const trendSrc  = window14.length >= 3 ? window14 : sorted.slice(-6);

  let trend: Trend     = "stable";
  let trendPct14d      = 0;
  let predicted14d: number | null = null;
  let predicted30d: number | null = null;
  let confidence: Confidence      = "low";
  let reg: { slope: number; intercept: number } | null = null;

  if (trendSrc.length >= 3) {
    const origin = trendSrc[0].date.getTime();
    const pts = trendSrc.map((s) => ({
      x: (s.date.getTime() - origin) / 86_400_000,
      y: s.minPrice,
    }));
    reg = linearRegression(pts);

    if (reg) {
      const currentX = (now.getTime() - origin) / 86_400_000;
      const pred14x  = currentX + 14;
      const pred30x  = currentX + 30;

      predicted14d = Math.max(1, Math.round(reg.slope * pred14x + reg.intercept));
      predicted30d = Math.max(1, Math.round(reg.slope * pred30x + reg.intercept));

      // % change over 14 days based on slope
      trendPct14d = currentPrice > 0
        ? Math.round((reg.slope * 14 / currentPrice) * 1000) / 10
        : 0;

      if      (trendPct14d <= -2)  trend = "dropping";
      else if (trendPct14d >= 2)   trend = "rising";
      else                         trend = "stable";

      confidence = dataPoints >= 14 ? "high" : dataPoints >= 7 ? "medium" : "low";
    }
  }

  // ── Next sale event ──────────────────────────────────────────────────────
  const saleEvent = nextSaleEvent(60);

  // ── Verdict logic ────────────────────────────────────────────────────────
  let verdict: Verdict;
  const belowAvg = vsAvg30dPct !== null && vsAvg30dPct <= -10;
  const nearAvg  = vsAvg30dPct !== null && vsAvg30dPct >= -5 && vsAvg30dPct <= 5;
  const aboveAvg = vsAvg30dPct !== null && vsAvg30dPct >= 8;
  const droppingFast = trendPct14d <= -4;

  if (belowAvg && trend !== "rising") {
    verdict = "buy";
  } else if (saleEvent && saleEvent.daysUntil <= 21 && (nearAvg || aboveAvg)) {
    verdict = "wait_sale";
  } else if (droppingFast && avg30d !== null) {
    verdict = "wait_drop";
  } else if (vsAvg30dPct !== null && vsAvg30dPct <= -5) {
    verdict = "buy";
  } else {
    verdict = "watch";
  }

  // ── Thai text generation ─────────────────────────────────────────────────
  const fmt = (n: number) => n.toLocaleString("th-TH");
  const pctLabel = (pct: number) =>
    pct < 0 ? `ต่ำกว่าค่าเฉลี่ย ${Math.abs(pct)}%` : `สูงกว่าค่าเฉลี่ย ${pct}%`;

  let verdictLabel: string;
  let verdictEmoji: string;
  let summary: string;
  let details: string;
  let tip: string;

  switch (verdict) {
    case "buy": {
      verdictLabel = "ควรซื้อเลย!";
      verdictEmoji = "✅";
      summary      = avg30d
        ? `ราคานี้ ${pctLabel(vsAvg30dPct!)} ใน 30 วันที่ผ่านมา — ถือว่าดีมาก`
        : `ราคานี้อยู่ในระดับที่น่าซื้อ`;
      details      = [
        avg30d      ? `ค่าเฉลี่ย 30 วัน อยู่ที่ ฿${fmt(Math.round(avg30d))} แต่ราคาตอนนี้ ฿${fmt(currentPrice)} ต่ำกว่าอย่างเห็นได้ชัด` : "",
        trend === "dropping" ? `นอกจากนี้ราคายังมีแนวโน้มลดลงต่อเนื่อง แต่ถ้ารอต่อมีความเสี่ยงที่ราคาจะกลับขึ้น` : "",
        trend === "stable"   ? `ราคาค่อนข้างนิ่งในช่วง 2 สัปดาห์ที่ผ่านมา ไม่น่าจะลดลงมากกว่านี้` : "",
        trend === "rising"   ? `ควรรีบตัดสินใจก่อนที่ราคาจะสูงขึ้นอีก` : "",
        allTimeMin && currentPrice <= allTimeMin * 1.05
          ? `⚡ ราคานี้ใกล้เคียงกับราคาต่ำสุดตลอดกาล (฿${fmt(allTimeMin)})!` : "",
      ].filter(Boolean).join(" ");
      tip = saleEvent
        ? `หากรอถึงโปร ${saleEvent.name} อีก ${saleEvent.daysUntil} วัน อาจได้ส่วนลดเพิ่ม แต่ราคาตอนนี้ก็คุ้มค่าแล้ว`
        : `แนะนำให้ซื้อได้เลย — ราคาดีกว่าปกติและไม่มีโปรใหญ่ใกล้นี้`;
      break;
    }

    case "wait_sale": {
      verdictLabel = `รอโปร ${saleEvent!.name}`;
      verdictEmoji = "🗓";
      summary      = `อีกเพียง ${saleEvent!.daysUntil} วัน จะถึงโปร ${saleEvent!.name} — น่าจะได้ส่วนลดเพิ่ม`;
      details      = [
        avg30d ? `ราคาปัจจุบัน ฿${fmt(currentPrice)} อยู่ใกล้เคียงกับค่าเฉลี่ย 30 วัน (฿${fmt(Math.round(avg30d))})` : "",
        `ช่วงโปรแฟลชเซลมักให้ส่วนลด 10–25% สำหรับสินค้าอิเล็กทรอนิกส์และแฟชั่น`,
        trend === "stable" || trend === "rising"
          ? `ราคาในช่วงนี้ค่อนข้างนิ่งหรือมีแนวโน้มขึ้น จึงไม่มีแรงจูงใจรีบซื้อตอนนี้`
          : "",
      ].filter(Boolean).join(" ");
      tip = `ตั้งการแจ้งเตือนราคาไว้ก่อน แล้วรอเข้าช็อปในช่วงโปร ${saleEvent!.name}`;
      break;
    }

    case "wait_drop": {
      verdictLabel = "รอราคาลงอีก";
      verdictEmoji = "📉";
      const dropAmt = predicted14d ? fmt(currentPrice - predicted14d) : null;
      summary      = `ราคากำลังลดลงต่อเนื่อง — ในอีก 14 วันอาจประหยัดได้${dropAmt ? ` ฿${dropAmt}` : ""}`;
      details      = [
        `ช่วง 14 วันที่ผ่านมาราคาลดลง ${Math.abs(trendPct14d)}% ซึ่งถือว่าชัดเจน`,
        predicted14d
          ? `จากแนวโน้มนี้ ราคาอาจอยู่ที่ประมาณ ฿${fmt(predicted14d)} ในอีก 14 วัน (${confidence === "high" ? "ความน่าเชื่อถือสูง" : confidence === "medium" ? "ความน่าเชื่อถือปานกลาง" : "ข้อมูลยังน้อย อาจคลาดเคลื่อน"})`
          : "",
      ].filter(Boolean).join(" ");
      tip = `ติดตามราคาต่ออีก 1–2 สัปดาห์ หรือตั้งการแจ้งเตือนที่ราคา ฿${predicted14d ? fmt(predicted14d) : "เป้าหมายของคุณ"}`;
      break;
    }

    default: {  // "watch"
      verdictLabel = "ราคาปกติ";
      verdictEmoji = "👀";
      summary      = avg30d
        ? `ราคาปัจจุบันอยู่ใกล้เคียงค่าเฉลี่ย — ยังไม่มีสัญญาณพิเศษในขณะนี้`
        : `ยังมีข้อมูลราคาไม่เพียงพอสำหรับการวิเคราะห์เชิงลึก`;
      details      = [
        avg30d ? `ราคา ฿${fmt(currentPrice)} อยู่ห่างจากค่าเฉลี่ย 30 วัน (฿${fmt(Math.round(avg30d))}) เพียง ${vsAvg30dPct !== null ? Math.abs(vsAvg30dPct) : "?"}%` : "รอให้ระบบเก็บข้อมูลราคาเพิ่มเติมสักระยะ จะได้วิเคราะห์แนวโน้มได้แม่นยำขึ้น",
        trend === "stable" ? "แนวโน้มราคาค่อนข้างทรงตัวในช่วงนี้" : "",
        saleEvent ? `อีก ${saleEvent.daysUntil} วัน จะถึงโปร ${saleEvent.name} ซึ่งอาจมีส่วนลดน่าสนใจ` : "",
      ].filter(Boolean).join(" ");
      tip = saleEvent && saleEvent.daysUntil <= 30
        ? `ลองรอดูช่วงโปร ${saleEvent.name} ก่อน แล้วตัดสินใจอีกที`
        : `ตั้งการแจ้งเตือนราคาเพื่อไม่พลาดเมื่อราคาลดลงถึงเป้าหมาย`;
    }
  }

  // Clean up empty details
  if (!details.trim()) {
    details = "ระบบกำลังเก็บข้อมูลราคา ยิ่งมีข้อมูลมากขึ้นเท่าไหร่การวิเคราะห์จะแม่นยำขึ้นเรื่อยๆ";
  }

  return {
    currentPrice,
    avg30d:       avg30d  ? Math.round(avg30d)  : null,
    avg60d:       avg60d  ? Math.round(avg60d)  : null,
    allTimeMin,
    allTimeMax,
    vsAvg30dPct,
    trend,
    trendPct14d,
    predicted14d,
    predicted30d,
    confidence,
    nextSaleEvent: saleEvent,
    verdict,
    verdictLabel,
    verdictEmoji,
    summary,
    details,
    tip,
    dataPoints,
    analysedAt: now.toISOString(),
  };
}
