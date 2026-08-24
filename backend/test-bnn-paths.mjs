/**
 * Quick check: do more specific BNN sub-paths exist?
 */
import { chromium } from "playwright";

const PATHS = [
  "/p/apple/apple-mac/macbook-air",
  "/p/apple/apple-mac/macbook-air-m4",
  "/p/apple/apple-ipad/ipad-air",
  "/p/apple/apple-ipad/ipad-air-m3",
  "/p/notebook/asus/asus-rog",
  "/p/notebook/asus/asus-rog-zephyrus",
  "/p/notebook/asus/asus-rog-zephyrus-g14",
  "/p/audio/sony/sony-headphone",
  "/p/audio-and-headphone/sony",
];

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});
const page = await ctx.newPage();

for (const path of PATHS) {
  const url = `https://www.bnn.in.th${path}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12_000 }).catch(() => {});
  const title = await page.title().catch(() => "?");
  const isError = title.includes("ขออภัย") || title.includes("404") || title.includes("Not Found");
  const count = isError ? 0 : await page.evaluate(() =>
    document.querySelectorAll('[class*="product-item"]').length
  ).catch(() => 0);
  console.log(`${isError ? "❌" : "✅"} ${path.padEnd(45)} ${count} cards  "${title.slice(0, 50)}"`);
}

await browser.close();
