import { Browser, BrowserContext, chromium } from "playwright";

let browser: Browser | null = null;

/** Get (or create) a singleton Chromium instance */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      // headless:false + off-screen window bypasses Lazada's headless detection
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--no-first-run",
        "--window-size=1366,768",
        "--window-position=-8000,-8000", // hide window off-screen
        "--lang=th-TH",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log("🌐 Browser launched");
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
 *
 * @param useProxy  When true AND SCRAPERAPI_KEY env var is set, routes all
 *                  requests through ScraperAPI's residential proxy to bypass
 *                  anti-bot systems that block Railway datacenter IPs.
 *                  Has no effect when SCRAPERAPI_KEY is not set (local dev).
 */
export async function createContext(useProxy = false): Promise<BrowserContext> {
  const b = await getBrowser();

  // ScraperAPI residential proxy — only active when key is configured
  const scraperApiKey = process.env.SCRAPERAPI_KEY;
  const proxyConfig = useProxy && scraperApiKey
    ? {
        proxy: {
          server:   "http://proxy.scraperapi.com:8080",
          username: "scraperapi",
          password: scraperApiKey,
        },
      }
    : {};

  if (useProxy && scraperApiKey) {
    console.log("🔀 Using ScraperAPI proxy");
  }

  const context = await b.newContext({
    ...proxyConfig,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: useProxy && !!scraperApiKey, // needed for proxy SSL
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
