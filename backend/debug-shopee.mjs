/**
 * Debug v9: Firefox — different fingerprint from Chrome
 * node debug-shopee.mjs [keyword]
 */
import { firefox } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dir, 'shopee-session.json');
const KEYWORD = process.argv[2] || 'iphone 15 pro max';

(async () => {
  if (!existsSync(SESSION_FILE)) { console.log('No session'); process.exit(1); }
  const storageState = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  console.log(`Session: ${storageState.cookies?.length} cookies | SPC_EC: ${storageState.cookies?.some(c=>c.name==='SPC_EC') ? '✅':'❌'}`);

  const browser = await firefox.launch({
    headless: false,
    args: ['-width', '1366', '-height', '768'],
    firefoxUserPrefs: {
      'general.useragent.override':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    },
  });

  const context = await browser.newContext({
    storageState,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8' },
  });

  const page = await context.newPage();
  let capturedItems = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('search_items')) return;
    console.log(`\n🎯 [${resp.status()}] search_items`);
    try {
      const text = await resp.text();
      const data = JSON.parse(text);
      console.log(`   error: ${data.error ?? 'NONE ✅'}`);
      const items = data?.items ?? data?.data?.items ?? [];
      if (items.length > 0) {
        capturedItems = items;
        console.log(`   ✅ ${items.length} items!`);
        items.slice(0, 5).forEach((it, i) => {
          const b = it.item_basic ?? it;
          console.log(`   [${i+1}] ฿${Math.round((b.price||0)/100000).toLocaleString()} | ${(b.name||'').slice(0,55)}`);
        });
      } else {
        console.log(`   body: ${text.slice(0,150)}`);
      }
    } catch {}
  });

  console.log(`\nSearching: "${KEYWORD}"…`);
  try {
    await page.goto(
      `https://shopee.co.th/search?keyword=${encodeURIComponent(KEYWORD)}&sortBy=pop`,
      { waitUntil: 'domcontentloaded', timeout: 25_000 }
    );
  } catch { console.log('(timeout ok)'); }

  for (let y = 0; y <= 1600; y += 300) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(3_500);

  console.log(`\nFinal URL: ${page.url().slice(0, 90)}`);
  console.log(`Items: ${capturedItems.length}`);

  await browser.close();
})();
