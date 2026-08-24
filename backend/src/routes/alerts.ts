import express from "express";
import Alert from "../models/Alert.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { protect, AuthRequest } from "../middleware/auth.js";
import { sendPriceAlertEmail } from "../utils/mailer.js";
import { sendLineNotify, buildPriceAlertMessage } from "../utils/lineNotify.js";

const router = express.Router();

// All routes require auth
router.use(protect);

// GET /api/alerts — my alerts
router.get("/", async (req: AuthRequest, res) => {
  try {
    const alerts = await Alert.find({ user: req.user?.id })
      .populate("product", "name nameTh image minPrice")
      .sort({ createdAt: -1 });
    res.json(alerts);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// POST /api/alerts — create alert
router.post("/", async (req: AuthRequest, res) => {
  const { productId, targetPrice } = req.body;

  if (!productId || !targetPrice) {
    res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: "ไม่พบสินค้า" });
      return;
    }

    // Update existing pending alert instead of duplicating
    const existing = await Alert.findOne({
      user: req.user?.id,
      product: productId,
      triggered: false,
    });
    if (existing) {
      existing.targetPrice = targetPrice;
      await existing.save();
      res.json({ alert: existing, message: "อัพเดทการแจ้งเตือนแล้ว" });
      return;
    }

    const alert = await Alert.create({
      user: req.user?.id,
      product: productId,
      targetPrice,
    });

    // If current price already meets the target → trigger immediately + email
    if (product.minPrice > 0 && product.minPrice <= targetPrice) {
      alert.triggered = true;
      alert.triggeredAt = new Date();
      await alert.save();

      // Send email + LINE Notify (fire & forget)
      const userData = await User.findById(req.user?.id).select("name email lineNotifyToken");
      if (userData) {
        const productUrl = `${process.env.APP_URL ?? "http://localhost:5173"}/product/${product._id}`;
        const productName = product.nameTh || product.name;

        if (userData.email) {
          sendPriceAlertEmail({
            to: userData.email,
            userName: userData.name,
            productName,
            productImage: product.image ?? "",
            productUrl,
            targetPrice,
            currentPrice: product.minPrice,
          }).catch((e) => console.error("[mailer] unexpected error:", e));
        }

        if (userData.lineNotifyToken) {
          sendLineNotify({
            token: userData.lineNotifyToken,
            message: buildPriceAlertMessage({
              productName,
              targetPrice,
              currentPrice: product.minPrice,
              productUrl,
            }),
          }).catch((e) => console.error("[LINE] unexpected error:", e));
        }
      }
    }

    res.status(201).json(alert);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// DELETE /api/alerts/:id — remove alert
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const alert = await Alert.findOneAndDelete({
      _id: req.params.id,
      user: req.user?.id,
    });
    if (!alert) {
      res.status(404).json({ message: "ไม่พบการแจ้งเตือน" });
      return;
    }
    res.json({ message: "ลบการแจ้งเตือนแล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

export default router;
