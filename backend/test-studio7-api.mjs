/**
 * Studio 7 API deep probe — verify product-groups endpoint.
 * Usage: node test-studio7-api.mjs "iPhone 16"
 */
const keyword = process.argv[2] || "iPhone 16";
const url = `https://api.studio7thailand.com/store/product-groups?q=${encodeURIComponent(keyword)}&in_stock=true&lang=th&page=1&limit=20`;

console.log(`\nGET ${url}\n`);
const resp = await fetch(url, {
  headers: {
    "accept": "application/json",
    "accept-language": "th-TH,th;q=0.9,en;q=0.8",
    "origin": "https://www.studio7thailand.com",
    "referer": "https://www.studio7thailand.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
});

console.log(`Status: ${resp.status}  Content-Type: ${resp.headers.get("content-type")}`);
const data = await resp.json();

const items = data?.data?.items ?? [];
console.log(`\nTotal items: ${items.length}`);
console.log("ALL keys of item[0]:", items[0] ? Object.keys(items[0]).join(", ") : "(empty)");

console.log("\n── First 5 products ──────────────────────────────────────");
for (const item of items.slice(0, 5)) {
  console.log(`\n  name:          ${item.name ?? "(no name field)"}`);
  console.log(`  slug:          ${item.product_group_slug}`);
  console.log(`  price:         ${item.primary_product_price}`);
  console.log(`  sku:           ${item.primary_product_sku}`);
  console.log(`  productSlug:   ${item.primary_product_slug}`);
  console.log(`  inStock:       ${!item.primary_pre_order}`);
  // Show ALL remaining keys too
  const other = Object.entries(item)
    .filter(([k]) => !["product_group_slug","primary_product_uid","primary_product_slug",
                        "primary_product_sku","primary_product_price","primary_pre_order",
                        "primary_is_pre_order","primary_product_categories"].includes(k))
    .slice(0, 8);
  if (other.length) console.log(`  other:         ${other.map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(" | ")}`);
}
