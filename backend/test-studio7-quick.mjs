/**
 * Quick Studio 7 scraper test.
 * Usage: node test-studio7-quick.mjs "iPhone 16"
 */
import { scrapeStudio7 } from "./dist/scraper/studio7.js";

const keyword = process.argv[2] || "iPhone 16";
console.log(`Testing Studio 7: "${keyword}"\n`);

const items = await scrapeStudio7(keyword);
if (items.length === 0) {
  console.log("❌ No results");
} else {
  console.log(`✅ ${items.length} results:`);
  console.log("─".repeat(75));
  for (const item of items.slice(0, 8)) {
    console.log(`  ฿${String(item.price.toLocaleString()).padEnd(9)} ${item.inStock ? "✅" : "❌"} "${item.name.slice(0, 50)}"`);
    console.log(`    → ${item.url.slice(0, 75)}`);
  }
  console.log("─".repeat(75));
}
process.exit(0);
