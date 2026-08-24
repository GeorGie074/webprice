import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, User, ShoppingBag, CheckCircle, AlertCircle } from "lucide-react";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api";
import axios from "axios";

type Tab = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tab, setTab] = useState<Tab>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Register state
  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPassword, setRPassword] = useState("");
  const [rConfirm, setRConfirm] = useState("");
  const [showRPwd, setShowRPwd] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      login(data.user, data.token);
      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "เกิดข้อผิดพลาด");
      } else {
        setError("ไม่สามารถเชื่อมต่อ server ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rPassword !== rConfirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.register(rName, rEmail, rPassword);
      login(data.user, data.token);
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "เกิดข้อผิดพลาด");
      } else {
        setError("ไม่สามารถเชื่อมต่อ server ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.googleLogin(response.credential);
      login(data.user, data.token);
      navigate(data.user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "เกิดข้อผิดพลาด");
      } else {
        setError("ไม่สามารถเชื่อมต่อ server ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = (p: string) => {
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    return s;
  };
  const str = pwdStrength(rPassword);
  const strColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"][str] || "#22c55e";
  const strLabel = ["", "อ่อนมาก", "อ่อน", "ปานกลาง", "แข็งแกร่ง"][str] || "แข็งแกร่ง";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-3 mb-8 group">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
            <ShoppingBag size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold leading-none">
              Price<span className="text-blue-400">Compare</span>
            </h1>
            <p className="text-slate-400 text-xs">เปรียบราคา ประหยัดได้จริง</p>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
                  tab === t ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-7">
            {/* Error */}
            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            {/* ── LOGIN ── */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com" required
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPwd ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" required className="input pl-10 pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex justify-center items-center gap-2">
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังตรวจสอบ...</>
                  ) : "เข้าสู่ระบบ"}
                </button>

                {/* Divider */}
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400 shrink-0">หรือเข้าสู่ระบบด้วย</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                {/* Google button */}
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("เข้าสู่ระบบ Google ล้มเหลว กรุณาลองใหม่")}
                    text="signin_with"
                    shape="rectangular"
                    size="large"
                    width="320"
                  />
                </div>

                <p className="text-center text-sm text-gray-500">
                  ยังไม่มีบัญชี?{" "}
                  <button type="button" onClick={() => { setTab("register"); setError(""); }}
                    className="text-blue-600 font-semibold hover:underline">
                    สมัครสมาชิกฟรี
                  </button>
                </p>
              </form>
            )}

            {/* ── REGISTER ── */}
            {tab === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อ-นามสกุล</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={rName} onChange={(e) => setRName(e.target.value)}
                      placeholder="สมชาย ใจดี" required className="input pl-10" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)}
                      placeholder="your@email.com" required className="input pl-10" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showRPwd ? "text" : "password"} value={rPassword}
                      onChange={(e) => setRPassword(e.target.value)}
                      placeholder="อย่างน้อย 6 ตัวอักษร" required className="input pl-10 pr-10" />
                    <button type="button" onClick={() => setShowRPwd(!showRPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showRPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {rPassword.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-colors"
                            style={{ backgroundColor: i <= str ? strColor : "#e5e7eb" }} />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: strColor }}>{strLabel}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ยืนยันรหัสผ่าน</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" value={rConfirm} onChange={(e) => setRConfirm(e.target.value)}
                      placeholder="ยืนยันรหัสผ่าน" required
                      className={`input pl-10 ${rConfirm && rConfirm !== rPassword ? "border-red-400 focus:border-red-400 focus:ring-red-500/20" : ""}`} />
                  </div>
                  {rConfirm && rConfirm !== rPassword && (
                    <p className="text-xs text-red-500 mt-1">รหัสผ่านไม่ตรงกัน</p>
                  )}
                  {rConfirm && rConfirm === rPassword && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={11} /> รหัสผ่านตรงกัน
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-blue-600" />
                  <span className="text-sm text-gray-600">
                    ฉันยอมรับ <span className="text-blue-600">ข้อกำหนดการใช้งาน</span> และ <span className="text-blue-600">นโยบายความเป็นส่วนตัว</span>
                  </span>
                </label>

                <button type="submit" disabled={loading || !agreed || (!!rConfirm && rPassword !== rConfirm)}
                  className="btn-primary w-full flex justify-center items-center gap-2">
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังสมัคร...</>
                  ) : "สร้างบัญชีฟรี"}
                </button>

                {/* Divider */}
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400 shrink-0">หรือสมัครด้วย</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                {/* Google button */}
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("สมัครสมาชิก Google ล้มเหลว กรุณาลองใหม่")}
                    text="signup_with"
                    shape="rectangular"
                    size="large"
                    width="320"
                  />
                </div>

                <p className="text-center text-sm text-gray-500">
                  มีบัญชีแล้ว?{" "}
                  <button type="button" onClick={() => { setTab("login"); setError(""); }}
                    className="text-blue-600 font-semibold hover:underline">
                    เข้าสู่ระบบ
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          © 2026 PriceCompare · เปรียบราคา ประหยัดได้จริง
        </p>
      </div>
    </div>
  );
}
