import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import alertRoutes from "./routes/alerts.js";
import adminRoutes from "./routes/admin.js";
import seedRoutes from "./routes/seed.js";
import scraperRoutes from "./routes/scraper.js";
import wishlistRoutes from "./routes/wishlist.js";
import visualSearchRoutes from "./routes/visualSearch.js";
import chatRoutes from "./routes/chat.js";
import imageProxyRoutes from "./routes/imageProxy.js";
import liveSearchRoutes from "./routes/liveSearch.js";
import { startPriceUpdateJob } from "./jobs/priceUpdate.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// Allow any localhost port in development (handles Vite port 5173, 5174, etc.)
const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,                        // local dev
  process.env.FRONTEND_URL,                            // production URL (e.g. https://myapp.vercel.app)
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);          // curl / server-to-server
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === "string" ? o === origin : (o as RegExp).test(origin)
    );
    allowed ? callback(null, true) : callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" })); // 10 MB for visual search base64 images

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/seed", seedRoutes);       // dev only
app.use("/api/scraper", scraperRoutes); // price scraper
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/visual-search", visualSearchRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/image-proxy", imageProxyRoutes);
app.use("/api/live-search", liveSearchRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Start ────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    startPriceUpdateJob(); // start 6-hour price refresh cron
  });
});
