/**
 * Quick test: Samsung Galaxy S25 only — verify FE is rejected.
 */
import mongoose from "mongoose";
import { updateProductPrices } from "./dist/scraper/index.js";

const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);

const db = mongoose.connection.db;
const product = await db.collection("products").findOne({ name: "Samsung Galaxy S25 256GB" });
if (!product) { console.error("❌ Product not found"); process.exit(1); }

console.log(`Testing: ${product.name} (${product._id})\n`);
const results = await updateProductPrices(String(product._id));
const r = results[0];
console.log("\n─── Result ───");
console.log("Lazada:", r.lazada.price ? `฿${r.lazada.price.toLocaleString()} → ${r.lazada.url?.slice(0,80)}` : "N/A");
console.log("BNN:   ", r.bnn.price    ? `฿${r.bnn.price.toLocaleString()}`    : "N/A");

await mongoose.disconnect();
