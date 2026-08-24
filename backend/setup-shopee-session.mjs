/**
 * SHOPEE SESSION SETUP with fingerprint spoofing
 * node setup-shopee-session.mjs
 *
 * Uses playwright-extra + stealth to generate a DIFFERENT canvas/WebGL fingerprint
 * so Shopee creates a new SPC_F that is not flagged.
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

chromium.use(StealthPlugin());

const __dir = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dir, 'shopee-session.json');

(async () => {
  console.log('\n🌐 Opening Chrome with fingerprint spoof…\n');

  const browser = await chromium.launch({
    channel: 'chrome',   // ← real installed Chrome, not bundled Chromium
    headless: false,
    args: [
      '--no-sandbox',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    extraHTTPHeaders: { 'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8' },
  });

  // Spoof canvas + WebGL fingerprint so SPC_F becomes a different value
  await context.addInitScript(() => {
    // ── Canvas noise (makes canvas hash different from real hardware) ────────
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;

    HTMLCanvasElement.prototype.toDataURL = function(type, ...args) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const img = ctx.getImageData(0, 0, this.width || 1, this.height || 1);
        img.data[0] = (img.data[0] + 7) % 256;   // fixed delta — consistent hash
        img.data[3] = (img.data[3] + 3) % 256;
        ctx.putImageData(img, 0, 0);
      }
      return toDataURL.call(this, type, ...args);
    };

    // ── WebGL renderer / vendor spoof ────────────────────────────────────────
    const getParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(p) {
      if (p === 37445) return 'NVIDIA Corporation';          // UNMASKED_VENDOR_WEBGL
      if (p === 37446) return 'NVIDIA GeForce GTX 1660 Ti'; // UNMASKED_RENDERER_WEBGL
      return getParam.call(this, p);
    };
    const getParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(p) {
      if (p === 37445) return 'NVIDIA Corporation';
      if (p === 37446) return 'NVIDIA GeForce GTX 1660 Ti';
      return getParam2.call(this, p);
    };

    // ── navigator.webdriver ──────────────────────────────────────────────────
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // Homepage first → Shopee generates SPC_F from spoofed fingerprint
  await page.goto('https://shopee.co.th/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(2_000);

  // Show the SPC_F value so we can confirm it changed
  const cookiesBefore = await context.cookies('https://shopee.co.th');
  const spcF = cookiesBefore.find(c => c.name === 'SPC_F');
  console.log(`SPC_F generated: ${spcF?.value?.slice(0, 30) ?? 'not found'}...`);

  await page.goto('https://shopee.co.th/buyer/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question(
      '\n👤 Login Shopee ในหน้าต่าง Chrome\n' +
      '   (email + password + OTP ถ้าถูกถาม)\n' +
      '   พอเห็น Home page → กด ENTER\n\n> ',
      () => { rl.close(); resolve(); }
    );
  });

  const cookies = await context.cookies();
  const hasAuth = cookies.some(c => c.name === 'SPC_EC' || c.name === 'SPC_U');

  if (!hasAuth) {
    console.log('\n⚠️  ยังไม่มี auth cookie');
    await browser.close(); process.exit(1);
  }

  const state = await context.storageState();
  writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));

  const spcFAfter = cookies.find(c => c.name === 'SPC_F');
  console.log(`\n✅ Session saved (${cookies.length} cookies)`);
  console.log(`   SPC_F: ${spcFAfter?.value?.slice(0, 30)}...`);
  console.log('   Auth: ' + cookies.filter(c => ['SPC_EC','SPC_U','SPC_F'].includes(c.name)).map(c=>c.name).join(', '));

  await browser.close();
})();
