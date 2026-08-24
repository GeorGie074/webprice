export interface PlatformCoupon {
  description: string;
  discount:    number;  // THB fixed amount (0 if percent-based)
  discountPct: number;  // percent discount (0 if fixed)
  minSpend:    number;  // minimum spend to qualify (0 = no minimum)
  afterPrice:  number;  // final price after coupon applied
}

export interface PlatformPrice {
  platform: string;
  price: number;
  originalPrice: number;
  url: string;
  inStock: boolean;
  shipping: number;
  rating: number;
  reviews: number;
  /** Coupon captured by scraper — undefined when none available */
  coupon?: PlatformCoupon;
  /** false = scraper ran but product not found on this platform → hidden from comparison */
  available?: boolean;
}

export interface PriceSnapshot {
  date: string;
  platforms: Array<{ platform: string; price: number }>;
  minPrice: number;
}

export interface Product {
  _id: string;
  name: string;
  nameTh: string;
  brand: string;
  category: string;
  image: string;
  images: string[];
  description: string;
  prices: PlatformPrice[];
  minPrice: number;
  maxPrice: number;
  tags: string[];
  featured: boolean;
  lastScraped?: string;
  createdAt: string;
  priceHistory?: PriceSnapshot[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
}

export interface Alert {
  _id: string;
  product: Product;
  targetPrice: number;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

// ─── Smart Buying Assistant ───────────────────────────────────────────────────

export type Verdict    = "buy" | "wait_sale" | "wait_drop" | "watch";
export type PriceTrend = "dropping" | "rising" | "stable";
export type Confidence = "high" | "medium" | "low";

export interface PriceInsight {
  currentPrice:    number;
  avg30d:          number | null;
  avg60d:          number | null;
  allTimeMin:      number | null;
  allTimeMax:      number | null;
  vsAvg30dPct:     number | null;
  trend:           PriceTrend;
  trendPct14d:     number;
  predicted14d:    number | null;
  predicted30d:    number | null;
  confidence:      Confidence;
  nextSaleEvent:   { name: string; daysUntil: number } | null;
  verdict:         Verdict;
  verdictLabel:    string;
  verdictEmoji:    string;
  summary:         string;
  details:         string;
  tip:             string;
  dataPoints:      number;
  analysedAt:      string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type Category = "smartphone" | "laptop" | "tablet" | "audio" | "home" | "fashion" | "beauty" | "health";

export const PLATFORM_COLORS: Record<string, string> = {
  "Shopee":         "#F97316",
  "Lazada":         "#7C3AED",
  "JD Central":     "#EF4444",
  "Apple Store":    "#555555",
  "Samsung Shop":   "#1428A0",
  "Power Buy":      "#059669",
  "Banana IT":      "#CA8A04",
  "Central Online": "#BE123C",
  "Sony Store":     "#1E293B",
  "Dyson Store":    "#C8102E",
  "Nike.com":       "#111827",
  "Studio 7":       "#2563EB",
  "JIB":            "#DC2626",
  "Watsons":        "#E91E8C",
};

/** Platforms that are scraped/integrated but not yet stable — shown grayed-out with เร็วๆ นี้ badge */
export const COMING_SOON_PLATFORMS: string[] = ["Shopee"];

/** Clearbit logo domain for each platform */
export const PLATFORM_LOGO_DOMAINS: Record<string, string> = {
  "Shopee":         "shopee.co.th",
  "Lazada":         "lazada.co.th",
  "JD Central":     "jd.co.th",
  "Apple Store":    "apple.com",
  "Samsung Shop":   "samsung.com",
  "Power Buy":      "powerbuy.co.th",
  "Banana IT":      "bnn.in.th",
  "Central Online": "central.co.th",
  "Sony Store":     "sony.com",
  "Dyson Store":    "dyson.com",
  "Nike.com":       "nike.com",
  "Studio 7":       "studio7thailand.com",
  "JIB":            "jib.co.th",
};
