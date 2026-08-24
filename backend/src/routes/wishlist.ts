import express from "express";
import User from "../models/User.js";
import { protect, AuthRequest } from "../middleware/auth.js";
import { sendLineNotify, buildPriceAlertMessage } from "../utils/lineNotify.js";

const router = express.Router();
router.use(protect);

// GET /api/wishlist — get my wishlist (populated)
router.get("/", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id)
      .select("wishlist")
      .populate("wishlist", "name nameTh image minPrice maxPrice brand category featured prices");
    res.json(user?.wishlist ?? []);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// POST /api/wishlist/:productId — add to wishlist
router.post("/:productId", async (req: AuthRequest, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { $addToSet: { wishlist: req.params.productId } },
      { new: true }
    ).select("wishlist");
    res.json({ wishlist: user?.wishlist ?? [], message: "เพิ่มในรายการโปรดแล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// DELETE /api/wishlist/:productId — remove from wishlist
router.delete("/:productId", async (req: AuthRequest, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { $pull: { wishlist: req.params.productId } },
      { new: true }
    ).select("wishlist");
    res.json({ wishlist: user?.wishlist ?? [], message: "นำออกจากรายการโปรดแล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// PUT /api/wishlist/line-token — save LINE Notify token
router.put("/line-token", async (req: AuthRequest, res) => {
  const { token } = req.body;
  try {
    // Validate token by sending a test message
    if (token) {
      const ok = await sendLineNotify({
        token,
        message: "\n✅ เชื่อมต่อ PriceCompare กับ LINE สำเร็จแล้ว!\nคุณจะได้รับแจ้งเตือนราคาผ่าน LINE โดยอัตโนมัติ 🎉",
      });
      if (!ok) {
        res.status(400).json({ message: "Token ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" });
        return;
      }
    }
    await User.findByIdAndUpdate(req.user?.id, {
      lineNotifyToken: token || undefined,
    });
    res.json({ message: token ? "เชื่อมต่อ LINE สำเร็จ!" : "ยกเลิกการเชื่อมต่อ LINE แล้ว" });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// GET /api/wishlist/line-token — check if user has LINE token
router.get("/line-token", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).select("lineNotifyToken");
    res.json({ connected: !!user?.lineNotifyToken });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

export default router;
