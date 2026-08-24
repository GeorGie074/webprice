import express from "express";
import { updateProductPrices, scraperProgress } from "../scraper/index.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ─── GET /api/scraper/progress ───────────────────────────────────────────────
// Returns current scraping progress (admin only). Safe to poll every 2s.
router.get("/progress", protect, adminOnly, (_req, res) => {
  res.json(scraperProgress);
});

// ─── POST /api/scraper/update ─────────────────────────────────────────────────
// Trigger a manual price update (admin only).
// Body: { productId?: string }  — omit to update ALL products
router.post("/update", protect, adminOnly, async (req, res) => {
  const { productId } = req.body as { productId?: string };

  // Run scraping in the background (don't block the HTTP response)
  updateProductPrices(productId)
    .then((report) => {
      const ok = report.filter((r) => r.success).length;
      console.log(`🎉 Manual scrape done: ${ok}/${report.length} products updated`);
    })
    .catch((err) => console.error("Manual scrape error:", err));

  res.json({
    message: productId
      ? `🔍 Scraping started for product ${productId}`
      : "🔍 Scraping all products in background",
    note: "Check server logs for progress. Prices update in DB as each product finishes.",
  });
});

// ─── POST /api/scraper/update/:id ────────────────────────────────────────────
// Trigger update for a single product by ID (admin only).
router.post("/update/:id", protect, adminOnly, async (req, res) => {
  const { id } = req.params;

  updateProductPrices(id)
    .then((report) => {
      const r = report[0];
      console.log(
        `🎉 Single scrape done for ${r?.productName}: Shopee ฿${r?.shopee.price ?? "N/A"} / Lazada ฿${r?.lazada.price ?? "N/A"}`
      );
    })
    .catch((err) => console.error("Single scrape error:", err));

  res.json({ message: `🔍 Scraping started for product ${id}` });
});

export default router;
