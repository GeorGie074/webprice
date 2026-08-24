import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Alert from "../models/Alert.js";
import SearchLog from "../models/SearchLog.js";
import Category from "../models/Category.js";
import { protect, adminOnly, AuthRequest } from "../middleware/auth.js";

const router = express.Router();
router.use(protect, adminOnly);

// ─── Known platforms (for scraper monitor) ───────────────────────────────────
// Includes all actively scraped platforms + new ones (Samsung, Sony, Dyson, Central, Nike, Apple)
const PLATFORMS = [
  "Lazada", "Banana IT", "Power Buy", "Studio 7", "JIB", "Shopee",
  "Samsung Shop", "Sony Store", "Dyson Store", "Central Online", "Nike.com", "Apple Store",
];

// ─── STATS ────────────────────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      users, products, alerts, lastScrapedDoc, triggeredAlerts,
      todaySearches, topSearchesRaw,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Alert.countDocuments(),
      Product.findOne({ lastScraped: { $exists: true } }).sort({ lastScraped: -1 }).select("lastScraped name"),
      Alert.countDocuments({ triggered: true }),
      SearchLog.countDocuments({ createdAt: { $gte: todayStart } }),
      SearchLog.aggregate([
        { $group: { _id: "$query", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const topSearches = topSearchesRaw.map((r: any) => ({ query: r._id, count: r.count }));

    res.json({
      users,
      products,
      alerts,
      triggeredAlerts,
      lastScraped: lastScrapedDoc?.lastScraped ?? null,
      todaySearches,
      topSearches,
      marketplaces: PLATFORMS,
    });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get("/analytics", async (_req, res) => {
  try {
    const now = new Date();

    // 7-day search trend
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailySearches = await SearchLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Bangkok" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing days with 0
    const trend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = dailySearches.find((x: any) => x._id === key);
      trend.push({ date: key, count: found?.count ?? 0 });
    }

    // Top 10 search keywords (all-time)
    const topKeywords = await SearchLog.aggregate([
      { $group: { _id: "$query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).then((r: any[]) => r.map((x) => ({ query: x._id, count: x.count })));

    // Category distribution
    const categoryDist = await Product.aggregate([
      { $match: { hidden: { $ne: true } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).then((r: any[]) => r.map((x) => ({ category: x._id, count: x.count })));

    // Price range buckets
    const priceBuckets = await Product.aggregate([
      { $match: { hidden: { $ne: true } } },
      {
        $bucket: {
          groupBy: "$minPrice",
          boundaries: [0, 500, 1000, 3000, 5000, 10000, 20000, 50000, 999999],
          default: "other",
          output: { count: { $sum: 1 } },
        },
      },
    ]).then((r: any[]) =>
      r.map((x) => ({
        label:
          x._id === 0     ? "< ฿500"       :
          x._id === 500   ? "฿500-1K"      :
          x._id === 1000  ? "฿1K-3K"       :
          x._id === 3000  ? "฿3K-5K"       :
          x._id === 5000  ? "฿5K-10K"      :
          x._id === 10000 ? "฿10K-20K"     :
          x._id === 20000 ? "฿20K-50K"     :
          x._id === 50000 ? "> ฿50K"       : "อื่นๆ",
        count: x.count,
      }))
    );

    // Top products by review count
    const topProducts = await Product.find({ hidden: { $ne: true } })
      .sort({ maxPrice: -1 })
      .limit(5)
      .select("nameTh brand minPrice category image")
      .lean();

    res.json({ trend, topKeywords, categoryDist, priceBuckets, topProducts });
  } catch (err) {
    console.error("[Analytics]", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ─── USERS ────────────────────────────────────────────────────────────────────
router.get("/users", async (_req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.delete("/users/:id", async (req: AuthRequest, res) => {
  if (req.params.id === req.user?.id) {
    res.status(400).json({ message: "ไม่สามารถลบตัวเองได้" });
    return;
  }
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "ลบผู้ใช้แล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ message: "Role ไม่ถูกต้อง" });
    return;
  }
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    res.json(user);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// PATCH /admin/users/:id/suspend — toggle suspended status
router.patch("/users/:id/suspend", async (req: AuthRequest, res) => {
  if (req.params.id === req.user?.id) {
    res.status(400).json({ message: "ไม่สามารถระงับบัญชีตัวเองได้" });
    return;
  }
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      res.status(404).json({ message: "ไม่พบผู้ใช้" });
      return;
    }
    user.suspended = !user.suspended;
    await user.save();
    res.json(user);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// GET /admin/users/:id/behavior — search history + wishlist
router.get("/users/:id/behavior", async (req, res) => {
  try {
    const [user, recentSearches] = await Promise.all([
      User.findById(req.params.id)
        .select("name email searchHistory wishlist suspended createdAt")
        .populate("wishlist", "nameTh name image minPrice category"),
      SearchLog.find({ userId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(30)
        .select("query createdAt"),
    ]);
    if (!user) {
      res.status(404).json({ message: "ไม่พบผู้ใช้" });
      return;
    }
    res.json({
      user,
      recentSearches,
      wishlist: (user as any).wishlist ?? [],
    });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ─── ALERTS (admin view) ──────────────────────────────────────────────────────
router.get("/alerts", async (_req, res) => {
  try {
    const alerts = await Alert.find()
      .populate("user", "name email")
      .populate("product", "nameTh name image minPrice")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(alerts);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
router.get("/products", async (_req, res) => {
  try {
    // Admin sees ALL products including hidden ones
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", error: err });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// PATCH /admin/products/:id/hidden — toggle hidden status
router.patch("/products/:id/hidden", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "ไม่พบสินค้า" });
      return;
    }
    product.hidden = !product.hidden;
    await product.save();
    res.json({ _id: product._id, hidden: product.hidden });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "ลบสินค้าแล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ─── SCRAPER STATUS ───────────────────────────────────────────────────────────
// Computes per-platform status from products data.
// "lastScraped" on a product = the time the whole product was last scraped.
// We infer per-platform status by checking if any product that LISTS that platform
// was recently scraped.
router.get("/scraper/status", async (_req, res) => {
  try {
    const products = await Product.find({ lastScraped: { $exists: true } })
      .select("lastScraped prices")
      .lean();

    // For each platform, find the most recent scrape across all products that list it
    const platformMap: Record<string, Date | null> = {};
    for (const plat of PLATFORMS) platformMap[plat] = null;

    for (const prod of products) {
      if (!prod.lastScraped) continue;
      const scraped = new Date(prod.lastScraped);
      for (const pp of prod.prices) {
        const plat = pp.platform;
        if (!platformMap.hasOwnProperty(plat)) continue;
        if (!platformMap[plat] || scraped > platformMap[plat]!) {
          platformMap[plat] = scraped;
        }
      }
    }

    const now = Date.now();
    const statuses = PLATFORMS.map((plat) => {
      const last = platformMap[plat];
      let status: "online" | "delay" | "offline" | "unknown" = "unknown";
      if (last) {
        const diffHours = (now - last.getTime()) / 3_600_000;
        if (diffHours <= 25)       status = "online";
        else if (diffHours <= 72)  status = "delay";
        else                       status = "offline";
      }
      return { platform: plat, lastScraped: last, status };
    });

    res.json(statuses);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
router.get("/categories", async (_req, res) => {
  try {
    const [dbCats, productCounts] = await Promise.all([
      Category.find().sort({ createdAt: 1 }),
      Product.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap: Record<string, number> = {};
    for (const r of productCounts) countMap[r._id] = r.count;

    // Merge default + DB categories
    const DEFAULT_CATS = [
      { name: "smartphone", label: "สมาร์ทโฟน",  emoji: "📱", isDefault: true },
      { name: "laptop",     label: "โน้ตบุ๊ค",    emoji: "💻", isDefault: true },
      { name: "tablet",     label: "แท็บเล็ต",    emoji: "📟", isDefault: true },
      { name: "audio",      label: "เสียง",        emoji: "🎧", isDefault: true },
      { name: "home",       label: "ในบ้าน",       emoji: "🏠", isDefault: true },
      { name: "fashion",    label: "แฟชั่น",       emoji: "👟", isDefault: true },
    ];

    const dbNames = new Set(dbCats.map((c) => c.name));
    const extra = dbCats.filter((c) => !DEFAULT_CATS.find((d) => d.name === c.name));
    const merged = [
      ...DEFAULT_CATS.map((d) => ({ ...d, _id: d.name, productCount: countMap[d.name] ?? 0 })),
      ...extra.map((c) => ({
        _id: c._id,
        name: c.name,
        label: c.label,
        emoji: c.emoji,
        isDefault: false,
        productCount: countMap[c.name] ?? 0,
      })),
    ];

    void dbNames; // suppress unused warning
    res.json(merged);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.post("/categories", async (req, res) => {
  const { name, label, emoji } = req.body;
  if (!name || !label) {
    res.status(400).json({ message: "กรุณากรอก name และ label" });
    return;
  }
  try {
    const cat = await Category.create({ name, label, emoji: emoji || "📦" });
    res.status(201).json(cat);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(400).json({ message: "หมวดหมู่นี้มีอยู่แล้ว" });
    } else {
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  }
});

router.delete("/categories/:name", async (req, res) => {
  const DEFAULT_NAMES = ["smartphone", "laptop", "tablet", "audio", "home", "fashion"];
  if (DEFAULT_NAMES.includes(req.params.name)) {
    res.status(400).json({ message: "ไม่สามารถลบหมวดหมู่เริ่มต้นได้" });
    return;
  }
  try {
    const productCount = await Product.countDocuments({ category: req.params.name });
    if (productCount > 0) {
      res.status(400).json({
        message: `ไม่สามารถลบได้ — มีสินค้า ${productCount} รายการในหมวดหมู่นี้`,
      });
      return;
    }
    await Category.deleteOne({ name: req.params.name });
    res.json({ message: "ลบหมวดหมู่แล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

export default router;
