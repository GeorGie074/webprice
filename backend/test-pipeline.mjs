/**
 * Full pipeline test: scrape one product by name via updateProductPrices()
 * to verify Lazada → BNN sequential flow works and DB is updated.
 *
 * Usage: node test-pipeline.mjs
 */
import mongoose from "mongoose";
import { updateProductPrices } from "./dist/scraper/index.js";

const MONGO_URI = "mongodb://localhost:27017/webprice";

await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected\n");

// Find iPhone 16 product ID
const db = mongoose.connection.db;
const iphone = await db.collection("products").findOne({ name: "iPhone 16 128GB" });
if (!iphone) { console.error("❌ iPhone 16 not found"); process.exit(1); }
console.log(`Product: ${iphone.name} (id: ${iphone._id})`);
const bnnBefore = iphone.prices.find(p => p.platform === "Banana IT");
console.log(`BNN before: ฿${bnnBefore?.price} | ${bnnBefore?.url}\n`);

// Run the full scrape for just this product
const results = await updateProductPrices(String(iphone._id));
const r = results[0];
console.log("\n─── Result ───");
console.log("Success:", r.success);
console.log("Lazada: ", r.lazada);
console.log("BNN:    ", r.bnn);
if (r.error) console.log("Error: ", r.error);

// Verify DB was updated
const updated = await db.collection("products").findOne({ _id: iphone._id });
const bnnAfter = updated.prices.find(p => p.platform === "Banana IT");
const lazadaAfter = updated.prices.find(p => p.platform === "Lazada");
console.log("\n─── DB after scrape ───");
console.log(`Lazada: ฿${lazadaAfter?.price} → ${lazadaAfter?.url?.slice(0, 80)}`);
console.log(`BNN:    ฿${bnnAfter?.price} → ${bnnAfter?.url?.slice(0, 80)}`);

await mongoose.disconnect();
console.log("\n✅ Done");
