/**
 * One-time backfill: create an initial price snapshot from current prices
 * for every product that doesn't have any history yet.
 * Usage: node backfill-history.mjs
 */
import mongoose from "mongoose";

await mongoose.connect("mongodb://localhost:27017/webprice");
const db = mongoose.connection.db;

const COMING_SOON = ["Shopee"];
const products = await db.collection("products").find({}).toArray();
let updated = 0;

for (const product of products) {
  if (product.priceHistory && product.priceHistory.length > 0) {
    console.log(`⏭  ${product.name} — already has history, skipping`);
    continue;
  }
  const activePrices = (product.prices || []).filter(
    (p) => p.available !== false && !COMING_SOON.includes(p.platform)
  );
  if (activePrices.length === 0) continue;

  const snapshot = {
    date: product.lastScraped || product.createdAt || new Date(),
    platforms: activePrices.map((p) => ({ platform: p.platform, price: p.price })),
    minPrice: Math.min(...activePrices.map((p) => p.price)),
  };

  await db.collection("products").updateOne(
    { _id: product._id },
    { $push: { priceHistory: snapshot } }
  );
  console.log(`✅ ${product.name} → backfilled snapshot (minPrice ฿${snapshot.minPrice.toLocaleString()})`);
  updated++;
}

console.log(`\n📦 Done — ${updated}/${products.length} products backfilled`);
await mongoose.disconnect();
