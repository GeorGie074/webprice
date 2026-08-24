import mongoose, { Document } from "mongoose";

/**
 * Platforms that are not yet fully integrated (scraper disabled).
 * Their prices are seed placeholders — excluded from minPrice/maxPrice
 * calculations so they don't distort the "cheapest" display.
 * Keep in sync with frontend COMING_SOON_PLATFORMS in types/index.ts.
 */
const COMING_SOON_PLATFORMS = ["Shopee"];

/**
 * Coupon / voucher available on this platform for this product.
 * Captured live by the scraper — may not exist on every platform/product.
 */
export interface ICoupon {
  description: string;  // "ลด ฿50 เมื่อซื้อครบ ฿500"
  discount:    number;  // THB absolute discount (0 if percent-based)
  discountPct: number;  // Percent discount (0 if fixed)
  minSpend:    number;  // Minimum spend to qualify (0 = no minimum)
  afterPrice:  number;  // Final price after coupon applied
}

export interface IPlatformPrice {
  platform: string;
  price: number;
  originalPrice: number;
  url: string;
  inStock: boolean;
  shipping: number;
  rating: number;
  reviews: number;
  /** Coupon / promotion captured by scraper — undefined when none available */
  coupon?: ICoupon;
  /**
   * `true`  = platform carries this product (scraper found it, or manual seed entry).
   * `false` = scraper ran but could NOT find this product on this platform.
   *           The entry is kept for reference but hidden from the comparison table.
   * `undefined` = never been scraped yet (seed default — treated as available).
   */
  available?: boolean;
}

/**
 * One price snapshot — recorded every time the scraper runs.
 * Stores the cheapest price per active platform at that moment.
 * Max 180 entries kept (rolling window ≈ 6 months if scraped daily).
 */
export interface IPriceSnapshot {
  date: Date;
  platforms: Array<{ platform: string; price: number }>;
  minPrice: number;
}

export interface IProduct extends Document {
  name: string;
  nameTh: string;
  brand: string;
  category: string;
  image: string;
  images: string[];
  description: string;
  prices: IPlatformPrice[];
  minPrice: number;
  maxPrice: number;
  tags: string[];
  featured: boolean;
  /** When true the product is hidden from public listings (admin-only) */
  hidden: boolean;
  lastScraped?: Date;
  createdAt: Date;
  /** Optional override for Lazada search keyword (skips auto-generated term) */
  searchKeyword?: string;
  /** Price history snapshots (max 180, newest last) */
  priceHistory: IPriceSnapshot[];
}

const priceSnapshotSchema = new mongoose.Schema<IPriceSnapshot>(
  {
    date:      { type: Date,   required: true, default: Date.now },
    platforms: [{ platform: String, price: Number, _id: false }],
    minPrice:  { type: Number, required: true },
  },
  { _id: false }
);

const couponSchema = new mongoose.Schema<ICoupon>(
  {
    description: { type: String, required: true },
    discount:    { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    minSpend:    { type: Number, default: 0 },
    afterPrice:  { type: Number, required: true },
  },
  { _id: false }
);

const platformPriceSchema = new mongoose.Schema<IPlatformPrice>({
  platform:      { type: String,  required: true },
  price:         { type: Number,  required: true },
  originalPrice: { type: Number,  required: true },
  url:           { type: String,  required: true },
  inStock:       { type: Boolean, default: true  },
  shipping:      { type: Number,  default: 0     },
  rating:        { type: Number,  default: 0     },
  reviews:       { type: Number,  default: 0     },
  coupon:        { type: couponSchema, default: undefined },
  available:     { type: Boolean, default: undefined }, // undefined = not yet scraped
});

const productSchema = new mongoose.Schema<IProduct>(
  {
    name: { type: String, required: true },
    nameTh: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: String, required: true },
    image: { type: String, default: "" },
    images: [{ type: String }],
    description: { type: String },
    prices: [platformPriceSchema],
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    tags: [{ type: String }],
    featured: { type: Boolean, default: false },
    hidden:    { type: Boolean, default: false },
    lastScraped:   { type: Date },
    searchKeyword: { type: String },
    priceHistory:  { type: [priceSnapshotSchema], default: [] },
  },
  { timestamps: true }
);

// Auto-calculate min/max price before saving.
// Excludes:
//   • entries where available === false (scraper ran, product not found on platform)
//   • COMING_SOON_PLATFORMS (seed placeholder prices — unreliable / not real-time)
productSchema.pre("save", function (next) {
  if (this.prices && this.prices.length > 0) {
    const pricesForCalc = this.prices.filter(
      (p) => p.available !== false && !COMING_SOON_PLATFORMS.includes(p.platform)
    );
    // Fall back to all prices if every entry was filtered out (edge case)
    const source = pricesForCalc.length > 0 ? pricesForCalc : this.prices;
    this.minPrice = Math.min(...source.map((p) => p.price));
    this.maxPrice = Math.max(...source.map((p) => p.price));
  }
  next();
});

export default mongoose.model<IProduct>("Product", productSchema);
