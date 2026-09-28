/**
 * Local Price Scraper Runner
 * รัน script นี้จาก PC ส่วนตัวเพื่อดึงราคาจาก Lazada/BNN/PowerBuy
 * และบันทึกตรงไปยัง MongoDB Atlas โดยไม่ผ่าน Railway
 *
 * วิธีรัน:
 *   cd D:\webprice-new\backend
 *   npx tsx src/scripts/runScraper.ts
 *
 * หรือใช้ run-scraper.bat ที่ root ของ project
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { updateProductPrices } from "../scraper/index.js";

const LINE = "=".repeat(60);

async function main() {
  console.log(LINE);
  console.log("  🚀 PriceCompare — Local Scraper");
  console.log(`  ⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
  console.log(LINE);

  // ── Connect to Atlas ────────────────────────────────────────────
  try {
    await connectDB();
    console.log("✅ MongoDB Atlas connected\n");
  } catch (err) {
    console.error("❌ ต่อ MongoDB ไม่ได้:", err);
    process.exit(1);
  }

  // ── Parse CLI args ──────────────────────────────────────────────
  // Usage examples:
  //   npx tsx src/scripts/runScraper.ts                    → all products
  //   npx tsx src/scripts/runScraper.ts --name "iphone 17" → filtered by name
  //   npx tsx src/scripts/runScraper.ts --id <mongoId>     → single product
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf("--name");
  const idIdx   = args.indexOf("--id");
  const nameFilter = nameIdx !== -1 ? args[nameIdx + 1] : undefined;
  const idFilter   = idIdx   !== -1 ? args[idIdx   + 1] : undefined;

  if (nameFilter) console.log(`🔍 กรองเฉพาะสินค้าที่ชื่อมี: "${nameFilter}"\n`);
  if (idFilter)   console.log(`🔍 รันเฉพาะ product ID: ${idFilter}\n`);

  // ── Run Scraper ─────────────────────────────────────────────────
  let exitCode = 0;
  try {
    const results = await updateProductPrices(idFilter, nameFilter);

    const success = results.filter((r) => r.success).length;
    const failed  = results.filter((r) => !r.success).length;

    console.log("\n" + LINE);
    console.log("  📊 สรุปผล:");
    console.log(`     ✅ สำเร็จ : ${success} สินค้า`);
    console.log(`     ❌ ล้มเหลว: ${failed} สินค้า`);
    console.log(`  ⏰ เสร็จสิ้น: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
    console.log(LINE);

    if (failed > 0) exitCode = 1;
  } catch (err) {
    console.error("\n❌ Scraper error:", err);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
}

main();
