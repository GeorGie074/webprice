/**
 * Test saved Shopee session
 * Run: node test-shopee-session.mjs [keyword]
 *
 * Must run `node setup-shopee-session.mjs` first to create shopee-session.json
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { existsSync, readFileSync } from 'fs';

chromium.use(StealthPlugin());

const SESSION_FILE = new URL('./shopee-session.json', import.meta.url).pathname.slice(1);
const KEYWORD = process.argv[2] || 'iphone 15 pro max';

(async () => {
  if (!existsSync(SESSION_FILE)) {
    console.log('❌ shopee-session.json not found.');
    console.log('   Run: node setup-shopee-session.mjs');
    process.exit(1);
  }

  const storageState = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  const hasAuth = storageState.cookies?.some(c => c.name === 'SPC_EC' || c.name === 'SPC_U');
  console.log(`Session loaded — cookies: ${storageState.cookies?.length ?? 0} | auth: ${hasAuth ? '✅' : '⚠️ (missing SPC_EC/SPC_U)'}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    storageState,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8' },
  });

  const page = await context.newPage();
  const results = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('shopee.co.th')) return;
    if (!url.includes('search_items') && !url.includes('search/search')) return;
    try {
      const data = await resp.json();
      const items = data?.items ?? data?.data?.items ?? [];
      if (items.length > 0) {
        results.push(...items);
        console.log(`📦 API captured ${items.length} items from: …${url.slice(30, 85)}`);
      }
    } catch {}
  });

  console.log(`\nSearching for "${KEYWORD}"…`);
  try {
    await page.goto(
      `https://shopee.co.th/search?keyword=${encodeURIComponent(KEYWORD)}&sortBy=pop`,
      { waitUntil: 'domcontentloaded', timeout: 25_000 }
    );
  } catch {
    console.log('(Navigation timed out, continuing…)');
  }

  const finalUrl = page.url();
  console.log(`Final URL: ${finalUrl.slice(0, 90)}`);

  if (finalUrl.includes('verify/traffic') || finalUrl.includes('login')) {
    console.log('\n❌ Session expired or invalid — run setup-shopee-session.mjs again');
    await browser.close();
    process.exit(1);
  }

  // Scroll to trigger product loading
  for (let y = 0; y <= 1600; y += 400) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2_500);

  if (results.length === 0) {
    // DOM fallback
    const domItems = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-sqe="item"], [class*="col-xs-2-4"]'));
      return cards.slice(0, 5).map(c => ({
        text: c.innerText?.slice(0, 80),
        link: c.querySelector('a')?.href?.slice(0, 80),
      }));
    }).catch(() => []);
    console.log(`\nDOM cards: ${domItems.length}`);
    domItems.forEach((d, i) => console.log(`  [${i+1}] ${d.text?.replace(/\n/g, ' ')}`));
  } else {
    console.log(`\n✅ Total items: ${results.length}`);
    results.slice(0, 8).forEach((item, i) => {
      const b = item.item_basic ?? item;
      const price = Math.round((b.price || 0) / 100_000);
      const star = Number(b.item_rating?.rating_star ?? 0).toFixed(1);
      console.log(`  [${i+1}] ฿${String(price.toLocaleString()).padStart(8)} ⭐${star}  ${(b.name || '').slice(0, 55)}`);
    });
  }

  await browser.close();
})();
