/**
 * Quick Power Buy scraper test — uses the real scraper (not smoke test).
 * Usage: node test-powerbuy-quick.mjs "iPhone 16"
 */
import { scrapePowerBuy } from "./dist/scraper/powerbuy.js";

const keyword = process.argv[2] || "iPhone 16";
console.log(`Testing Power Buy: "${keyword}"\n`);

const items = await scrapePowerBuy(keyword);

if (items.length === 0) {
  console.log("❌ No results");
} else {
  console.log(`✅ ${items.length} results:`);
  console.log("─".repeat(70));
  for (const item of items.slice(0, 6)) {
    console.log(`  ฿${String(item.price.toLocaleString()).padEnd(9)} ${item.inStock ? "✅" : "❌"} "${item.name.slice(0, 55)}"`);
    console.log(`    → ${item.url.slice(0, 75)}`);
  }
  console.log("─".repeat(70));
}

process.exit(0);
