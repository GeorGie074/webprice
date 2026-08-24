/**
 * Full pipeline test — scrapes ALL products via Lazada + BNN + Power Buy + Studio 7 + JIB,
 * prints a summary table, and reports what was updated in DB.
 *
 * Usage: node test-all-products.mjs
 */
import mongoose from "mongoose";
import { updateProductPrices } from "./dist/scraper/index.js";

const MONGO_URI = "mongodb://localhost:27017/webprice";

await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected\n");
console.log("🚀 Starting full pipeline — Lazada + BNN + Power Buy + Studio 7 + JIB for all products\n");
console.log("=".repeat(110));

const start = Date.now();
const results = await updateProductPrices(); // no ID = all products
const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

console.log("\n" + "=".repeat(110));
console.log(`\n📊 SUMMARY (${elapsed} min)\n`);
console.log(
  "Product".padEnd(36) +
  "Lazada".padEnd(12) +
  "BNN".padEnd(12) +
  "PowerBuy".padEnd(12) +
  "Studio7".padEnd(12) +
  "JIB".padEnd(12) +
  "Status"
);
console.log("─".repeat(110));

for (const r of results) {
  const name    = r.productName.slice(0, 34).padEnd(35);
  const lazada  = r.lazada.price     ? `฿${r.lazada.price.toLocaleString()}`     : "N/A";
  const bnn     = r.bnn.price        ? `฿${r.bnn.price.toLocaleString()}`        : "N/A";
  const pb      = r.powerBuy?.price  ? `฿${r.powerBuy.price.toLocaleString()}`   : "N/A";
  const s7      = r.studio7?.price   ? `฿${r.studio7.price.toLocaleString()}`    : "N/A";
  const jib     = r.jib?.price       ? `฿${r.jib.price.toLocaleString()}`        : "N/A";
  const status  = r.success ? "✅" : `❌ ${r.error?.slice(0, 20) ?? ""}`;
  console.log(
    `${name} ${lazada.padEnd(11)} ${bnn.padEnd(11)} ${pb.padEnd(11)} ${s7.padEnd(11)} ${jib.padEnd(11)} ${status}`
  );
}

console.log("─".repeat(110));
const ok   = results.filter(r => r.success).length;
const fail = results.filter(r => !r.success).length;
console.log(`\n✅ ${ok} succeeded   ${fail > 0 ? `❌ ${fail} failed` : ""}`);

await mongoose.disconnect();
console.log("Done.\n");
