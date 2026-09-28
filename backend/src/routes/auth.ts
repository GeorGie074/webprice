import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { protect, AuthRequest } from "../middleware/auth.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";

const router = express.Router();

function signToken(id: string) {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    return;
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      res.status(400).json({ message: "อีเมลนี้ถูกใช้งานแล้ว" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = signToken(user.id);

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "กรุณากรอก email และรหัสผ่าน" });
    return;
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: "ไม่พบผู้ใช้งาน" });
      return;
    }

    // Account registered via Google — no local password
    if (!user.password) {
      res.status(400).json({
        message: "บัญชีนี้ใช้การเข้าสู่ระบบผ่าน Google กรุณากดปุ่ม Sign in with Google",
      });
      return;
    }

    if (user.suspended) {
      res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    });
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// ── POST /api/auth/google ───────────────────────────────────────────────────
// Receives Google ID token from frontend, verifies it, finds-or-creates user
router.post("/google", async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400).json({ message: "ไม่พบ Google credential" });
    return;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(500).json({ message: "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID บน server" });
    return;
  }

  try {
    // Verify the ID token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(400).json({ message: "ไม่สามารถยืนยันตัวตน Google ได้" });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    // Find by googleId first, then fall back to email (links an existing account)
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // Brand-new user — create account (no password needed)
      user = await User.create({
        name:   name || email.split("@")[0],
        email,
        googleId,
        avatar: picture,
      });
    } else {
      // Existing user — link Google ID if not already set
      let changed = false;
      if (!user.googleId)          { user.googleId = googleId; changed = true; }
      if (picture && !user.avatar) { user.avatar   = picture;  changed = true; }
      if (changed) await user.save();
    }

    if (user.suspended) {
      res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(400).json({ message: "การยืนยันตัวตน Google ล้มเหลว กรุณาลองใหม่" });
  }
});

// ── POST /api/auth/forgot-password ─────────────────────────────────────────
// Step 1: user submits email → generate token → send reset link
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: "กรุณากรอกอีเมล" });
    return;
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return 200 — don't reveal whether the email exists
    if (!user || !user.password) {
      res.json({ message: "หากอีเมลนี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้" });
      return;
    }

    // Generate a random 32-byte token, store its SHA-256 hash in DB
    const rawToken  = crypto.randomBytes(32).toString("hex");
    const hashToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.passwordResetToken   = hashToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const appUrl  = process.env.APP_URL ?? "http://localhost:5173";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to:       user.email,
      userName: user.name,
      resetUrl,
    });

    res.json({ message: "หากอีเมลนี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้" });
  } catch (err) {
    console.error("[auth] forgot-password error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// ── POST /api/auth/reset-password ──────────────────────────────────────────
// Step 2: user submits new password + token from email link
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    return;
  }

  try {
    const hashToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token that hasn't expired yet
    // Must use +passwordResetToken to override select:false
    const user = await User
      .findOne({
        passwordResetToken:   hashToken,
        passwordResetExpires: { $gt: new Date() },
      })
      .select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      res.status(400).json({ message: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว" });
      return;
    }

    // Update password and clear the reset token
    user.password             = await bcrypt.hash(password, 10);
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Auto-login: return a fresh JWT
    const jwtToken = signToken(user.id);
    res.json({
      message: "เปลี่ยนรหัสผ่านสำเร็จ",
      token:   jwtToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[auth] reset-password error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/me", protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).select("-password");
    res.json(user);
  } catch {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

export default router;
