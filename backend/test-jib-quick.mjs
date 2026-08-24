/**
 * Quick JIB scraper test.
 * Usage: node test-jib-quick.mjs "MacBook Air M5"
 */
import { scrapeJIB } from "./dist/scraper/jib.js";

const keyword = process.argv[2] || "MacBook Air M5";
console.log(`Testing JIB: "${keyword}"\n`);

const items = await scrapeJIB(keyword);
if (items.length === 0) {
  console.log("❌ No results");
} else {
  console.log(`✅ ${items.length} results:`);
  console.log("─".repeat(75));
  for (const item of items.slice(0, 8)) {
    console.log(`  ฿${String(item.price.toLocaleString()).padEnd(9)} ${item.inStock ? "✅" : "❌"} "${item.name.slice(0, 52)}"`);
    console.log(`    → ${item.url.slice(0, 80)}`);
  }
  console.log("─".repeat(75));
}
process.exit(0);
