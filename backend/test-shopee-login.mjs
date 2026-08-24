import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

chromium.use(StealthPlugin());

// ใส่ Shopee account ของคุณที่นี่เพื่อทดสอบ
const SHOPEE_USER = process.env.SHOPEE_USER || '';
const SHOPEE_PASS = process.env.SHOPEE_PASS || '';

(async () => {
  if (!SHOPEE_USER || !SHOPEE_PASS) {
    console.log('❌ กรุณาตั้ง SHOPEE_USER และ SHOPEE_PASS ก่อน');
    console.log('   ตัวอย่าง: SHOPEE_USER=youremail@gmail.com SHOPEE_PASS=yourpassword node test-shopee-login.mjs');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1366, height: 768 },
  });

  const page = await context.newPage();
  const apiItems = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('shopee.co.th') && url.includes('search_items')) {
      try {
        const data = await resp.json();
        const items = data?.items ?? [];
        if (items.length > 0) {
          console.log(`✅ Captured ${items.length} items!`);
          items.slice(0, 5).forEach((item, i) => {
            const b = item.item_basic ?? item;
            console.log(`  [${i+1}] ฿${Math.round((b.price||0)/100000)} | ${(b.name||'').slice(0,60)}`);
          });
          apiItems.push(...items);
        }
      } catch {}
    }
  });

  // ─── Step 1: Login ──────────────────────────────────────────────────────────
  console.log('1. Navigating to Shopee login...');
  await page.goto('https://shopee.co.th/buyer/login', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Take screenshot to see login form
  writeFileSync('D:/webprice-new/shopee-login.jpg', await page.screenshot({ type: 'jpeg', quality: 60 }));
  console.log('   Login page screenshot saved');

  // Fill credentials
  const emailInput = page.locator('input[name="loginKey"], input[type="text"]').first();
  await emailInput.fill(SHOPEE_USER);
  await page.waitForTimeout(800);

  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(SHOPEE_PASS);
  await page.waitForTimeout(800);

  // Click login button
  const loginBtn = page.locator('button[type="submit"], button:has-text("เข้าสู่ระบบ"), button:has-text("Log In")').first();
  await loginBtn.click();
  console.log('2. Login submitted, waiting...');
  await page.waitForTimeout(5000);

  console.log('   After login URL:', page.url().slice(0, 80));
  writeFileSync('D:/webprice-new/shopee-after-login.jpg', await page.screenshot({ type: 'jpeg', quality: 60 }));

  // Check if logged in
  const isLoggedIn = page.url().includes('shopee.co.th') && !page.url().includes('login');
  console.log('   Logged in:', isLoggedIn ? '✅ YES' : '❌ NO (might need OTP)');

  // ─── Step 2: Search ─────────────────────────────────────────────────────────
  if (isLoggedIn) {
    console.log('3. Searching for iPhone 15 Pro Max...');
    await page.goto('https://shopee.co.th/search?keyword=iphone+15+pro+max&sortBy=pop', {
      waitUntil: 'domcontentloaded', timeout: 25000,
    });
    for (let y = 0; y <= 1200; y += 300) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(3000);

    writeFileSync('D:/webprice-new/shopee-results.jpg', await page.screenshot({ type: 'jpeg', quality: 60 }));
    console.log('   Results screenshot saved');
    console.log('   API items captured:', apiItems.length);
  }

  await browser.close();
})();
