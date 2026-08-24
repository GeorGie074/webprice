/**
 * Dump raw __NEXT_DATA__ product structure to find real price fields.
 */
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768", "--window-position=-8000,-8000", "--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
});
const page = await ctx.newPage();

await page.goto("https://www.powerbuy.co.th/th", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(2_000);

await page.goto("https://www.powerbuy.co.th/th/search/iPhone%2016", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2_000);

const info = await page.evaluate(() => {
  const nd = window.__NEXT_DATA__;
  const products = nd?.props?.pageProps?.productListData?.products ?? [];
  // Show ALL keys + values from first 3 products
  return products.slice(0, 3).map(p => JSON.stringify(p, null, 2));
});

console.log(`\nTotal products: ${(await page.evaluate(() => (window.__NEXT_DATA__?.props?.pageProps?.productListData?.products ?? []).length))}`);
for (let i = 0; i < info.length; i++) {
  console.log(`\n─── Product [${i}] ───`);
  console.log(info[i]);
}

await ctx.close();
await browser.close();
