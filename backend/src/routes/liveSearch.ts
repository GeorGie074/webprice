import express from "express";
import { protect } from "../middleware/auth.js";
import type { ScrapedItem } from "../scraper/shopee.js";

import { scrapeLazada }   from "../scraper/lazada.js";
import { scrapeBNN }      from "../scraper/bnn.js";
import { scrapePowerBuy } from "../scraper/powerbuy.js";
import { scrapeStudio7 }  from "../scraper/studio7.js";
import { scrapeJIB }      from "../scraper/jib.js";
import { scrapeSamsung }  from "../scraper/samsung.js";
import { scrapeSony }     from "../scraper/sony.js";
import { scrapeDyson }    from "../scraper/dyson.js";
import { scrapeCentral }  from "../scraper/central.js";
import { scrapeNike }     from "../scraper/nike.js";
import { scrapeApple }    from "../scraper/apple.js";
import { scrapeWatsons }  from "../scraper/watsons.js";

const router = express.Router();

// ─── Platform registry ────────────────────────────────────────────────────────

type ScraperFn = (keyword: string) => Promise<ScrapedItem[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  lazada:   scrapeLazada,
  bnn:      scrapeBNN,
  powerbuy: scrapePowerBuy,
  studio7:  scrapeStudio7,
  jib:      scrapeJIB,
  samsung:  scrapeSamsung,
  sony:     scrapeSony,
  dyson:    scrapeDyson,
  central:  scrapeCentral,
  nike:     scrapeNike,
  apple:    scrapeApple,
  watsons:  scrapeWatsons,
};

export const LIVE_SEARCH_PLATFORMS: { id: string; label: string }[] = [
  { id: "lazada",   label: "Lazada"         },
  { id: "bnn",      label: "Banana IT"      },
  { id: "powerbuy", label: "Power Buy"      },
  { id: "jib",      label: "JIB"            },
  { id: "central",  label: "Central Online" },
  { id: "samsung",  label: "Samsung Shop"   },
  { id: "sony",     label: "Sony Store"     },
  { id: "apple",    label: "Apple Store"    },
  { id: "studio7",  label: "Studio 7"       },
  { id: "dyson",    label: "Dyson Store"    },
  { id: "nike",     label: "Nike.com"       },
  { id: "watsons",  label: "Watsons"        },
];

// ─── POST /api/live-search ────────────────────────────────────────────────────
// Member-only live scrape from a chosen platform.
// WARNING: each call launches a real Playwright browser → 10–30 s latency.
router.post("/", protect, async (req, res) => {
  const { query, platform, limit = 20 } = req.body as {
    query:    string;
    platform: string;
    limit?:   number;
  };

  if (!query?.trim()) {
    return res.status(400).json({ message: "กรุณาระบุคำค้นหา" });
  }

  const scraper = SCRAPERS[platform];
  if (!scraper) {
    return res.status(400).json({
      message: `ไม่รู้จักแพลตฟอร์ม: ${platform}`,
      available: LIVE_SEARCH_PLATFORMS.map((p) => p.id),
    });
  }

  const label = LIVE_SEARCH_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
  console.log(`[live-search] "${query}" on ${label} (limit ${limit})`);

  try {
    const items = await scraper(query.trim());
    const results = items.slice(0, limit);

    console.log(`[live-search] ✅ ${label}: ${results.length}/${items.length} results for "${query}"`);

    return res.json({
      platform: label,
      platformId: platform,
      query: query.trim(),
      total: items.length,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(`[live-search] ❌ ${label} error:`, (err as Error).message);
    return res.status(500).json({
      message: `ค้นหาจาก ${label} ไม่สำเร็จ — แพลตฟอร์มอาจไม่พร้อมให้บริการชั่วคราว`,
      error:   (err as Error).message,
    });
  }
});

export default router;
