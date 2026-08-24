/**
 * fix-urls-final.mjs
 *
 * แก้ปัญหา URL 2 ร้านค้า:
 *
 *  1. Lazada — เปลี่ยน pdp-i*.html ที่เหลือทั้งหมด → catalog search URL
 *  2. Studio 7 — URL structure เปลี่ยนเป็น /en/collection/ ทั้งหมด
 *                + แก้ราคาที่ scraper ดึงมาผิดตัว (accessory แทนสินค้าจริง)
 */
import mongoose from "mongoose";
const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected\n");

const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
const products = await Product.find({});

// ─── Studio 7 correct collection URLs ─────────────────────────────────────────
const S7_URL_MAP = [
  { pattern: /ไอโฟน 17|iPhone 17/,               url: "https://www.studio7thailand.com/th/collection/iphone-17-series" },
  { pattern: /ไอโฟน 16 โปร แมกซ์|iPhone 16 Pro Max/, url: "https://www.studio7thailand.com/en/collection/iphone-16-pro-series" },
  { pattern: /แมคบุ๊ค แอร์ M5|MacBook Air M5/,    url: "https://www.studio7thailand.com/en/collection/macbook-air-series" },
  { pattern: /แมคบุ๊ค โปร M4|MacBook Pro M4/,     url: "https://www.studio7thailand.com/en/collection/macbook-pro-series" },
  { pattern: /ไอแพด แอร์ M3|iPad Air M3/,          url: "https://www.studio7thailand.com/en/collection/apple-ipad-air-series" },
  { pattern: /ไอแพด โปร M4|iPad Pro M4/,           url: "https://www.studio7thailand.com/en/collection/apple-ipad-pro-series" },
  { pattern: /ไอแพด มินิ 7|iPad mini 7/,           url: "https://www.studio7thailand.com/en/collection/apple-ipad-mini-series" },
  { pattern: /แอปเปิล วอทช์ ซีรีส์ 10|Apple Watch Series 10/, url: "https://www.studio7thailand.com/en/collection/apple-watch-series-10" },
];

// ราคาที่ถูกต้องสำหรับสินค้าที่ scraper ดึงมาผิด (ราคาต่ำกว่า 1,000 บาท = accessory ไม่ใช่สินค้าจริง)
const S7_PRICE_FIX = {
  "ไอโฟน 16 โปร แมกซ์ 256GB": { price: 46900, originalPrice: 46900 },  // was ฿790 (screen protector)
  "ไอแพด มินิ 7 WiFi 128GB":   { price: 17900, originalPrice: 17900 },  // was ฿190 (screen film)
};

// ─── Helper: deep-copy a price entry safely ───────────────────────────────────
function clonePrice(p) {
  // Support both Mongoose subdocuments and plain objects
  const obj = typeof p.toObject === "function" ? p.toObject() : JSON.parse(JSON.stringify(p));
  return obj;
}

let lazadaFixed = 0;
let s7UrlFixed = 0;
let s7PriceFixed = 0;

for (const product of products) {
  const keyword   = product.searchKeyword || product.name || product.nameTh;
  const nameTh    = product.nameTh || "";
  const q         = encodeURIComponent(keyword);
  let changed     = false;

  // Find Studio 7 URL mapping for this product
  const s7Mapping = S7_URL_MAP.find(
    m => m.pattern.test(nameTh) || m.pattern.test(product.name || "")
  );
  const s7PriceFix = S7_PRICE_FIX[nameTh];

  const newPrices = product.prices.map(p => {
    const entry = clonePrice(p);

    // ── Lazada: replace pdp-i / .html URLs ──
    if (
      entry.platform === "Lazada" &&
      entry.url &&
      entry.url.includes("lazada.co.th") &&
      (entry.url.includes("/pdp-i") || (entry.url.includes("lazada") && entry.url.includes(".html")))
    ) {
      const newUrl = `https://www.lazada.co.th/catalog/?q=${q}`;
      console.log(`  [Lazada] ${nameTh}`);
      console.log(`    OLD: ${entry.url.substring(0, 80)}`);
      console.log(`    NEW: ${newUrl}`);
      entry.url = newUrl;
      lazadaFixed++;
      changed = true;
    }

    // ── Studio 7: fix URL ──
    if (entry.platform === "Studio 7" && s7Mapping && entry.url !== s7Mapping.url) {
      console.log(`  [Studio 7 URL] ${nameTh}`);
      console.log(`    OLD: ${(entry.url || "").substring(0, 80)}`);
      console.log(`    NEW: ${s7Mapping.url}`);
      entry.url = s7Mapping.url;
      s7UrlFixed++;
      changed = true;
    }

    // ── Studio 7: fix wrong price from accessory ──
    if (entry.platform === "Studio 7" && s7PriceFix && entry.price < 1000) {
      console.log(`  [Studio 7 Price] ${nameTh}: ฿${entry.price} → ฿${s7PriceFix.price}`);
      entry.price         = s7PriceFix.price;
      entry.originalPrice = s7PriceFix.originalPrice;
      s7PriceFixed++;
      changed = true;
    }

    return entry;
  });

  if (changed) {
    await Product.updateOne({ _id: product._id }, { $set: { prices: newPrices } });
  }
}

// ─── Update minPrice / maxPrice for affected products ─────────────────────────
const updated = await Product.find({});
let minMaxFixed = 0;
for (const p of updated) {
  const validPrices = (p.prices || []).filter(pr => pr.price > 0).map(pr => pr.price);
  if (validPrices.length === 0) continue;
  const minP = Math.min(...validPrices);
  const maxP = Math.max(...validPrices);
  if (p.minPrice !== minP || p.maxPrice !== maxP) {
    await Product.updateOne({ _id: p._id }, { $set: { minPrice: minP, maxPrice: maxP } });
    minMaxFixed++;
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`✅ Lazada pdp-i URLs แก้แล้ว  : ${lazadaFixed} รายการ`);
console.log(`✅ Studio 7 URLs แก้แล้ว      : ${s7UrlFixed} รายการ`);
console.log(`✅ Studio 7 ราคาแก้แล้ว       : ${s7PriceFixed} รายการ`);
console.log(`✅ minPrice/maxPrice อัปเดต    : ${minMaxFixed} สินค้า`);

// ─── Verify ───────────────────────────────────────────────────────────────────
const remainingBad = await Product.countDocuments({
  "prices": { $elemMatch: { platform: "Lazada", url: /pdp-i.*\.html/ } }
});
const s7ThProduct = await Product.countDocuments({
  "prices": { $elemMatch: { platform: "Studio 7", url: /\/th\/product\// } }
});
console.log(`\n🔍 Lazada pdp-i URLs เหลือ   : ${remainingBad}`);
console.log(`🔍 Studio 7 /th/product/ เหลือ: ${s7ThProduct}`);

await mongoose.disconnect();
console.log("\n✅ Done!");
