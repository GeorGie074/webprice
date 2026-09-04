import { Browser, BrowserContext, chromium } from "playwright";

// Single browser singleton for local Playwright usage.
// On Railway (SCRAPERAPI_KEY set), scrapers use ScraperAPI API mode
// (HTTP fetch on port 80) and do NOT need a browser at all.
//
// Linux without $DISPLAY = Railway Docker container → headless required.
// Local Windows/Mac = headed to bypass anti-bot fingerprint checks.
let browser: Browser | null = null;

const needsHeadless = process.platform === "linux" && !process.env.DISPLAY;

const BASE_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
  "--disable-infobars",
  "--no-first-run",
  "--window-size=1366,768",
  "--lang=th-TH",
];
if (!needsHeadless) BASE_ARGS.push("--window-position=-8000,-8000");

/** Get (or launch) the shared browser singleton. */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: needsHeadless,
      args: BASE_ARGS,
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log(`🌐 Browser launched (${needsHeadless ? "headless" : "headed"})`);
  }
  return browser;
}

/** Stealth init script — patch navigator to hide automation signals */
const STEALTH_SCRIPT = `
  // Hide webdriver property
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // Fake plugins (real Chrome has plugins)
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });
  // Fake languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['th-TH', 'th', 'en-US', 'en'],
  });
  // Fake chrome runtime object (headless Chrome lacks this)
  window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {}
  };
  // Prevent iframe contentWindow detection
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);
`;

/**
 * Create a new browser context mimicking a real Thai Chrome user.
 * The useProxy parameter is kept for API compatibility but ignored —
 * scrapers that need proxy now use ScraperAPI API mode directly (no browser proxy).
 */
export async function createContext(useProxy = false): Promise<BrowserContext> {
  const b = await getBrowser();

  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: useProxy,
    extraHTTPHeaders: {
      "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });
  // Inject stealth script into every new page before any JS runs
  await context.addInitScript(STEALTH_SCRIPT);
  return context;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log("🔴 Browser closed");
  }
}
