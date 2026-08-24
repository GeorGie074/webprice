import express from "express";
import Product from "../models/Product.js";
import SearchLog from "../models/SearchLog.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { analyzePriceHistory } from "../services/priceAnalysis.js";

const router = express.Router();

// GET /api/products — list with optional search & category filter
router.get("/", async (req, res) => {
  try {
    const { q, category, featured, limit = "20", page = "1" } = req.query;

    // Always hide products with hidden=true from public listings
    const filter: Record<string, unknown> = { hidden: { $ne: true } };

    if (q) {
      const qStr = String(q).trim();
      if (qStr) {
        filter.$or = [
          { name: { $regex: qStr, $options: "i" } },
          { nameTh: { $regex: qStr, $options: "i" } },
          { brand: { $regex: qStr, $options: "i" } },
          { tags: { $regex: qStr, $options: "i" } },
        ];

        // Log the search query asynchronously (fire-and-forget)
        const logEntry: { query: string; userId?: string } = { query: qStr };
        try {
          const auth = req.headers.authorization;
          if (auth?.startsWith("Bearer ")) {
            const decoded = jwt.verify(
              auth.split(" ")[1],
              process.env.JWT_SECRET || "secret"
            ) as { id: string };
            logEntry.userId = decoded.id;
          }
        } catch { /* ignore token errors */ }

        SearchLog.create(logEntry).catch(() => {});

        // Also push to user's searchHistory (last 30 entries)
        if (logEntry.userId) {
          User.findByIdAndUpdate(logEntry.userId, {
            $push: {
              searchHistory: {
                $each: [{ query: qStr, at: new Date() }],
                $slice: -30,
              },
            },
          }).catch(() => {});
        }
      }
    }

    if (category) filter.category = category;
    if (featured === "true") filter.featured = true;

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: Number(page), limit: Number(limit) });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "ไม่พบสินค้า" });
      return;
    }
    res.json(product);
  } catch {
    res.status(404).json({ message: "ไม่พบสินค้า" });
  }
});

// GET /api/products/:id/history?days=30
// Returns price history snapshots for charting.
// ?days=30 (default) | 60 | 90 — limits to last N days
router.get("/:id/history", async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180);
    const product = await Product.findById(req.params.id).select("name nameTh priceHistory");
    if (!product) {
      res.status(404).json({ message: "ไม่พบสินค้า" });
      return;
    }
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const history = (product.priceHistory || []).filter((s) => new Date(s.date) >= cutoff);
    res.json({ history, productName: product.name, productNameTh: product.nameTh });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// GET /api/products/:id/related — similar products (same category, excl. self)
router.get("/:id/related", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select("category brand minPrice");
    if (!product) {
      res.status(404).json({ message: "ไม่พบสินค้า" });
      return;
    }

    // Fetch up to 16 products from same category (excluding self + hidden)
    const candidates = await Product.find({
      _id:      { $ne: product._id },
      category: product.category,
      hidden:   { $ne: true },
    }).limit(16);

    // Sort: same brand first, then by price proximity
    const selfPrice = product.minPrice ?? 0;
    const sorted = [...candidates].sort((a, b) => {
      const sameBrandA = a.brand === product.brand ? 0 : 1;
      const sameBrandB = b.brand === product.brand ? 0 : 1;
      if (sameBrandA !== sameBrandB) return sameBrandA - sameBrandB;
      return Math.abs((a.minPrice ?? 0) - selfPrice) - Math.abs((b.minPrice ?? 0) - selfPrice);
    });

    res.json(sorted.slice(0, 8));
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// GET /api/products/:id/insights — Smart Buying Assistant analysis
router.get("/:id/insights", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select("name nameTh minPrice priceHistory category");
    if (!product) {
      res.status(404).json({ message: "ไม่พบสินค้า" });
      return;
    }

    // Map IPriceSnapshot → { date: Date, minPrice: number }
    const history = (product.priceHistory ?? []).map((s) => ({
      date:     new Date(s.date),
      minPrice: s.minPrice,
    }));

    const insight = analyzePriceHistory(history, product.minPrice);
    res.json(insight);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

export default router;
