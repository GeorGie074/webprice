/**
 * One-time patch: fix Sony Store entry for Sony WH-1000XM6
 *   URL:   /th/collections/wh1000xm6/ → /th/products/wh-1000xm6/
 *   price: 15990 → 10990 (current sale price, -31%)
 *
 * Usage: node fix-sony-url.mjs
 */
import mongoose from "mongoose";

await mongoose.connect("mongodb://localhost:27017/webprice");

const db = mongoose.connection.db;
const result = await db.collection("products").updateOne(
  { "prices.platform": "Sony Store", name: /WH-1000XM6/ },
  {
    $set: {
      "prices.$.url":           "https://store.sony.co.th/th/products/wh-1000xm6/",
      "prices.$.price":         10990,
      "prices.$.originalPrice": 15990,
    },
  }
);

if (result.matchedCount === 0) {
  console.error("❌ Product not found — check the name filter");
} else {
  console.log(`✅ Sony Store entry updated (matched=${result.matchedCount}, modified=${result.modifiedCount})`);
  console.log("   URL   → https://store.sony.co.th/th/products/wh-1000xm6/");
  console.log("   price → ฿10,990  (was ฿15,990)");
}

// Recalculate minPrice — Sony Store ฿10,990 is now the cheapest
// (only if no scraped platform is cheaper)
const product = await db.collection("products").findOne({ name: /WH-1000XM6/ });
const activePrices = product.prices.filter(
  (p) => p.available !== false && p.platform !== "Shopee"
);
const minPrice = Math.min(...activePrices.map((p) => p.price));
const maxPrice = Math.max(...activePrices.map((p) => p.price));
await db.collection("products").updateOne(
  { _id: product._id },
  { $set: { minPrice, maxPrice } }
);
console.log(`   minPrice recalculated → ฿${minPrice.toLocaleString()}`);
console.log(`   activePrices: ${activePrices.map(p => `${p.platform}=฿${p.price}`).join(", ")}`);

await mongoose.disconnect();
