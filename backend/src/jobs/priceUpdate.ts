import cron from "node-cron";
import { updateProductPrices } from "../scraper/index.js";

let isRunning = false;

/**
 * Start a cron job that updates all product prices every 6 hours.
 * Uses a lock flag to prevent overlapping runs.
 */
export function startPriceUpdateJob(): void {
  // Run at minute 0 of every 6th hour: 00:00, 06:00, 12:00, 18:00
  cron.schedule("0 */6 * * *", async () => {
    if (isRunning) {
      console.log("⏭️  Price update already running — skipping this tick");
      return;
    }
    isRunning = true;
    const startedAt = new Date().toISOString();
    console.log(`\n⏰ [${startedAt}] Scheduled price update started`);
    try {
      const report = await updateProductPrices();
      const ok = report.filter((r) => r.success).length;
      console.log(`✅ Scheduled price update done: ${ok}/${report.length} products updated`);
    } catch (err) {
      console.error("❌ Scheduled price update error:", err);
    } finally {
      isRunning = false;
    }
  });

  console.log("📅 Price update cron scheduled (every 6 hours: 00:00 / 06:00 / 12:00 / 18:00)");
}
