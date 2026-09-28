/**
 * Fix Missing / Broken Product Images
 * ค้นหาสินค้าที่ไม่มีรูป หรือรูปโหลดไม่ขึ้น แล้วดึงรูปใหม่จาก Lazada
 *
 * วิธีรัน:
 *   cd D:\webprice-new\backend
 *   npx tsx src/scripts/fixImages.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Product from "../models/Product.js";
import { scrapeLazada } from "../scraper/lazada.js";

const LINE = "=".repeat(60);

/** ตรวจสอบว่า URL รูปโหลดได้จริงไหม (HEAD request) */
async function isImageAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image");
  } catch {
    return false;
  }
}

async function main() {
  console.log(LINE);
  console.log("  🖼  Fix Missing / Broken Product Images");
  console.log(`  ⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
  console.log(LINE + "\n");

  await connectDB();
  console.log("✅ MongoDB Atlas connected\n");

  const products = await Product.find({});
  console.log(`📦 ตรวจสอบสินค้าทั้งหมด ${products.length} รายการ...\n`);

  const toFix: typeof products = [];

  // ── Phase 1: ตรวจหาสินค้าที่ต้องซ่อม ─────────────────────────────────────
  for (const product of products) {
    const img = product.image;

    if (!img || img.trim() === "") {
      console.log(`❌ ไม่มีรูป    : ${product.name}`);
      toFix.push(product);
      continue;
    }

    // ตรวจ URL ว่าโหลดได้ไหม (ข้าม slatic.net / lazada CDN เพราะ block HEAD)
    const skipCheck = ["slatic.net", "lazada", "shopee", "filebroker"].some(
      (d) => img.includes(d)
    );
    if (skipCheck) continue; // ถือว่า OK

    const alive = await isImageAlive(img);
    if (!alive) {
      console.log(`⚠️  รูปโหลดไม่ขึ้น: ${product.name}`);
      console.log(`   URL: ${img.slice(0, 80)}`);
      toFix.push(product);
    }
  }

  console.log(`\n📋 ต้องซ่อม ${toFix.length} รายการ\n`);
  if (toFix.length === 0) {
    console.log("✅ ทุกสินค้ามีรูปครบแล้ว!");
    await mongoose.disconnect();
    return;
  }

  // ── Phase 2: ดึงรูปจาก Lazada ───────────────────────────────────────────
  let fixed   = 0;
  let skipped = 0;

  for (const product of toFix) {
    const keyword = (product as any).searchKeyword
      || product.name.split(/\s+/).slice(0, 4).join(" ");

    console.log(`🔍 "${product.name}"`);
    console.log(`   ค้นหา Lazada: "${keyword}"`);

    try {
      const items = await scrapeLazada(keyword).catch(() => []);

      // หาผลลัพธ์ที่มีรูปและชื่อใกล้เคียง
      const imageItem = items.find(
        (i) => i.image && /^https?:\/\//i.test(i.image)
      );

      if (imageItem?.image) {
        await Product.findByIdAndUpdate(product._id, {
          $set: { image: imageItem.image },
        });
        console.log(`   ✅ อัปเดตรูปสำเร็จ`);
        console.log(`   📷 ${imageItem.image.slice(0, 80)}`);
        fixed++;
      } else {
        console.log(`   ⚠️  ไม่พบรูปจาก Lazada`);
        skipped++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${(err as Error).message}`);
      skipped++;
    }

    console.log();
    await new Promise((r) => setTimeout(r, 3_000));
  }

  // ── สรุป ──────────────────────────────────────────────────────────────────
  console.log(LINE);
  console.log("  📊 สรุป:");
  console.log(`     ✅ อัปเดตรูปสำเร็จ : ${fixed} สินค้า`);
  console.log(`     ⚠️  ยังไม่มีรูป     : ${skipped} สินค้า`);
  console.log(`  ⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
  console.log(LINE);

  if (skipped > 0) {
    const stillMissing = await Product.find({
      $or: [{ image: { $exists: false } }, { image: null }, { image: "" }],
    }).select("name");

    if (stillMissing.length > 0) {
      console.log("\n💡 สินค้าที่ยังไม่มีรูป (ต้องใส่เองใน Admin):");
      stillMissing.forEach((p) => console.log(`   • ${p.name}`));
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
