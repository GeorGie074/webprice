/**
 * update-urls.mjs — แก้ URL ของแต่ละ platform ให้ถูกต้อง
 *
 * ปัญหาที่แก้:
 *  1. Lazada "pdp-i*.html" → specific product listing ที่ expire ได้
 *     → เปลี่ยนเป็น catalog search URL ที่เสถียรกว่า
 *  2. BNN category-only URLs (เช่น /p/audio-and-headphone/apple)
 *     → ไม่ได้พาไปหน้าสินค้าที่ต้องการ เปลี่ยนเป็น search URL
 *
 * URL templates ที่เชื่อถือได้:
 *  - Shopee    : https://shopee.co.th/search?keyword={q}
 *  - Lazada    : https://www.lazada.co.th/catalog/?q={q}
 *  - JIB       : https://www.jib.co.th/web/product/product_search/0?str_search={q}
 *  - Power Buy : https://www.powerbuy.co.th/th/search/{q} (specific product URLs kept)
 *  - Banana IT : https://www.bnn.in.th/search?q={q}
 *  - Studio 7  : https://www.studio7thailand.com/search?q={q}
 *
 * Usage: node update-urls.mjs
 */
import mongoose from "mongoose";
const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected\n");

const Product = mongoose.model("Product", new mongoose.Schema({
  name: String, nameTh: String, searchKeyword: String,
  prices: [{ platform: String, price: Number, originalPrice: Number,
             url: String, inStock: Boolean, shipping: Number,
             rating: Number, reviews: Number }]
}, { strict: false }));

const products = await Product.find({});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build reliable search URL per platform
// ─────────────────────────────────────────────────────────────────────────────
function buildSearchUrl(platform, keyword) {
  const q = encodeURIComponent(keyword);
  switch (platform) {
    case "Shopee":       return `https://shopee.co.th/search?keyword=${q}`;
    case "Lazada":       return `https://www.lazada.co.th/catalog/?q=${q}`;
    case "JIB":          return `https://www.jib.co.th/web/product/product_search/0?str_search=${q}`;
    case "Power Buy":    return `https://www.powerbuy.co.th/th/search/${q}`;
    case "Banana IT":    return `https://www.bnn.in.th/search?q=${q}`;
    case "Studio 7":     return `https://www.studio7thailand.com/search?q=${q}`;
    case "Central Online": return `https://www.central.co.th/th/search?q=${q}`;
    case "Nike.com":     return `https://www.nike.com/th/w/?q=${q}&vst=${q}`;
    default:             return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// URL validation: returns true if URL needs to be replaced
// ─────────────────────────────────────────────────────────────────────────────
function needsReplacement(platform, url) {
  // Lazada PDP URLs (specific product listings that may expire)
  if (url.includes("lazada.co.th") && url.includes("/pdp-i")) return true;
  if (url.includes("lazada.co.th") && url.includes(".html")) return true;

  // BNN category pages (not specific product)
  if (url.includes("bnn.in.th")) {
    const path = url.replace(/https?:\/\/[^/]+/, "");
    // Category-only paths: /p/audio-and-headphone/apple, /p/apple/apple-mac, etc.
    // Keep if it looks like a specific product (has long slug with model info)
    const pathParts = path.split("/").filter(Boolean);
    if (pathParts[0] === "p" && pathParts.length <= 3) return true; // category path, not product
    // BNN /th/p/ format — keep only if has enough specificity (4+ path segments)
    if (pathParts[0] === "th" && pathParts[1] === "p" && pathParts.length <= 4) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Process each product
// ─────────────────────────────────────────────────────────────────────────────
let totalFixed = 0;

for (const product of products) {
  const keyword = product.searchKeyword || product.name || product.nameTh;
  let changed = false;
  const newPrices = product.prices.map(p => {
    if (needsReplacement(p.platform, p.url)) {
      const newUrl = buildSearchUrl(p.platform, keyword);
      if (newUrl && newUrl !== p.url) {
        console.log(`  ✅ [${p.platform}] ${product.nameTh}`);
        console.log(`     OLD: ${p.url.substring(0, 70)}`);
        console.log(`     NEW: ${newUrl}`);
        changed = true;
        totalFixed++;
        return { ...p.toObject(), url: newUrl };
      }
    }
    return p;
  });

  if (changed) {
    await Product.updateOne(
      { _id: product._id },
      { $set: { prices: newPrices } }
    );
  }
}

console.log(`\n📊 URL ที่แก้ไขแล้ว: ${totalFixed} รายการ`);
await mongoose.disconnect();
console.log("✅ Done!");
