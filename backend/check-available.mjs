import mongoose from "mongoose";
import Product from "./dist/models/Product.js";

await mongoose.connect("mongodb://localhost:27017/webprice");
const ipad = await Product.findOne({ name: /iPad Air M3/ });
console.log("\n📋 iPad Air M3 — available flags:");
ipad.prices.forEach(p => {
  const s = p.available === false ? "❌ HIDDEN" : p.available === true ? "✅ shown" : "⬜ seed (shown)";
  console.log(`  ${s}  ${p.platform.padEnd(16)} ฿${p.price.toLocaleString()}`);
});
console.log(`\n  minPrice → ฿${ipad.minPrice.toLocaleString()} (excludes hidden + Shopee)`);

const macbook = await Product.findOne({ name: /MacBook Air M5/ });
console.log("\n📋 MacBook Air M5 — available flags:");
macbook.prices.forEach(p => {
  const s = p.available === false ? "❌ HIDDEN" : p.available === true ? "✅ shown" : "⬜ seed (shown)";
  console.log(`  ${s}  ${p.platform.padEnd(16)} ฿${p.price.toLocaleString()}`);
});
console.log(`\n  minPrice → ฿${macbook.minPrice.toLocaleString()}`);
await mongoose.disconnect();
