import { Browser, BrowserContext, chromium } from "playwright";

// Two browser singletons:
// - regularBrowser: no proxy, for platforms that work on Railway (Samsung, Apple, etc.)
// - proxyBrowser:   ScraperAPI proxy set at LAUNCH level (Chrome --proxy-server flag),
//                   for platforms blocked on Railway (Lazada, BNN, JIB).
//
// Proxy MUST be set at browser launch (not context) for Chromium networking to use it.
let regularBrowser: Browser | null = null;
let proxyBrowser:   Browser | null = null;

// Linux without $DISPLAY = Railway Docker container → headless required.
// Local Windows/Mac = headed to bypass Lazada fingerprint detection.
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

/** Regular browser — no proxy */
export async function getBrowser(): Promise<Browser> {
  if (!regularBrowser || !regularBrowser.isConnected()) {
    regularBrowser = await chromium.launch({
      headless: needsHeadless,
      args: BASE_ARGS,
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log(`🌐 Browser launched (${needsHeadless ? "headless" : "headed"})`);
  }
  return regularBrowser;
}

/**
 * Proxy browser — ScraperAPI proxy set at Chrome launch level.
 * Falls back to regular browser if SCRAPERAPI_KEY is not set.
 */
export async function getProxyBrowser(): Promise<Browser> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) {
    console.log("⚠️  SCRAPERAPI_KEY not set — using regular browser (no proxy)");
    return getBrowser();
  }

  if (!proxyBrowser || !proxyBrowser.isConnected()) {
    proxyBrowser = await chromium.launch({
      headless: needsHeadless,
      proxy: {
        server:   "http://proxy.scraperapi.com:8080",
        username: "scraperapi",
        password: key,
      },
      args: BASE_ARGS,
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log(`🌐 Proxy browser launched (${needsHeadless ? "headless" : "headed"} + ScraperAPI)`);
  }
  return proxyBrowser;
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
 *
 * @param useProxy  When true, uses the proxy browser (ScraperAPI set at launch level).
 *                  When SCRAPERAPI_KEY is not set, falls back to regular browser.
 */
export async function createContext(useProxy = false): Promise<BrowserContext> {
  const b = useProxy ? await getProxyBrowser() : await getBrowser();

  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: useProxy, // proxy SSL interception
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
  if (regularBrowser) {
    await regularBrowser.close();
    regularBrowser = null;
    console.log("🔴 Browser closed");
  }
  if (proxyBrowser) {
    await proxyBrowser.close();
    proxyBrowser = null;
    console.log("🔴 Proxy browser closed");
  }
}
