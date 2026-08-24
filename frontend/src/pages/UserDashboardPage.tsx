import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsApi, wishlistApi } from "../api";
import { Alert, Product } from "../types";
import { proxyImage } from "../utils/imageUrl";
import {
  Bell, Trash2, CheckCircle, Clock, User, Shield,
  TrendingDown, Package, ArrowUpRight, ShoppingBag,
  Heart, MessageCircle, ExternalLink, X, Mail, Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ProductCard } from "../components/ui/ProductCard";

type MainTab = "alerts" | "wishlist" | "settings";
type AlertTab = "all" | "pending" | "triggered";

/* ── Email notification card ─────────────────────────────────────────────── */
const EMAIL_PREFS_KEY = "pc_email_prefs";

function EmailNotificationCard({ email }: { email: string }) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(EMAIL_PREFS_KEY) || "{}"); }
    catch { return {}; }
  })();
  const [enabled, setEnabled] = useState<boolean>(saved.enabled ?? true);
  const [onTarget, setOnTarget] = useState<boolean>(saved.onTarget ?? true);
  const [onDrop,   setOnDrop]   = useState<boolean>(saved.onDrop   ?? false);
  const [saved2,   setSaved2]   = useState(false);

  const save = () => {
    localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify({ enabled, onTarget, onDrop }));
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2500);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <Mail size={18} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">แจ้งเตือนทางอีเมล</h3>
          <p className="text-xs text-gray-500">ส่งไปที่ <span className="font-medium text-gray-700">{email}</span></p>
        </div>
        {/* Master toggle */}
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-2.5 mb-4 pl-1">
          {[
            { label: "เมื่อราคาถึงเป้าหมาย",     val: onTarget, set: setOnTarget },
            { label: "เมื่อราคาลด > 10% จากค่าเฉลี่ย", val: onDrop, set: setOnDrop },
          ].map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => set(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="btn-primary text-sm px-4 py-2"
        >
          {saved2 ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่า"}
        </button>
        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
          <Sparkles size={10} /> กำลังพัฒนา
        </span>
      </div>
    </div>
  );
}

function PriceDiffBar({ current, target }: { current: number; target: number }) {
  if (!current || !target) return null;
  const pct = Math.round(((current - target) / target) * 100);
  const isBelow = current <= target;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span
        className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
          isBelow
            ? "bg-green-100 text-green-700"
            : "bg-red-50 text-red-500"
        }`}
      >
        {isBelow ? `↓ ${Math.abs(pct)}%` : `↑ ${pct}%`} จากเป้า
      </span>
      {isBelow && (
        <span className="text-xs text-green-600 font-medium">ถึงเป้าแล้ว!</span>
      )}
    </div>
  );
}

export default function UserDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTab>("alerts");
  const [alertTab, setAlertTab] = useState<AlertTab>("all");
  const [lineToken, setLineToken] = useState("");
  const [lineMsg, setLineMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: alertsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  // Wishlist
  const { data: wlData, isLoading: loadingWl } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => wishlistApi.list(),
    staleTime: 60_000,
  });
  const wishlist: Product[] = (wlData?.data as Product[] | undefined) ?? [];

  const removeWlMutation = useMutation({
    mutationFn: (id: string) => wishlistApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  // LINE Notify status
  const { data: lineStatusData, refetch: refetchLineStatus } = useQuery({
    queryKey: ["line-status"],
    queryFn: () => wishlistApi.getLineStatus(),
    staleTime: Infinity,
  });
  const lineConnected: boolean = (lineStatusData?.data as { connected: boolean } | undefined)?.connected ?? false;

  const lineTokenMutation = useMutation({
    mutationFn: (token: string) => wishlistApi.setLineToken(token),
    onSuccess: (_, token) => {
      refetchLineStatus();
      setLineToken("");
      setLineMsg({ type: "ok", text: token ? "✅ เชื่อมต่อ LINE สำเร็จ! ตรวจสอบ LINE ของคุณ" : "ยกเลิกการเชื่อมต่อแล้ว" });
      setTimeout(() => setLineMsg(null), 5000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLineMsg({ type: "err", text: msg ?? "Token ไม่ถูกต้อง" });
    },
  });

  const alerts: Alert[] = data?.data ?? [];
  const pending = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  const displayed =
    alertTab === "pending" ? pending : alertTab === "triggered" ? triggered : alerts;

  const alertTabs: { key: AlertTab; label: string; count: number }[] = [
    { key: "all",       label: "ทั้งหมด",       count: alerts.length },
    { key: "pending",   label: "รอดำเนินการ",   count: pending.length },
    { key: "triggered", label: "ถึงเป้าแล้ว",    count: triggered.length },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/25 shrink-0">
          {user?.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{user?.name}</h1>
          <p className="text-gray-500 text-sm truncate">{user?.email}</p>
          <span
            className={`badge mt-1.5 ${
              user?.role === "admin"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {user?.role === "admin" ? (
              <><Shield size={11} className="inline mr-1" />Admin</>
            ) : (
              <><User size={11} className="inline mr-1" />สมาชิก</>
            )}
          </span>
        </div>
        {user?.role === "admin" && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-xl px-3 py-2 hover:bg-blue-50 transition-colors shrink-0"
          >
            <Shield size={13} /> Admin Panel
          </Link>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "ทั้งหมด",
            value: alerts.length,
            icon: Bell,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "รอดำเนินการ",
            value: pending.length,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "ถึงเป้าแล้ว",
            value: triggered.length,
            icon: CheckCircle,
            color: "text-green-600",
            bg: "bg-green-50",
          },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="w-8 h-8 bg-gray-100 rounded-xl mx-auto" />
                <div className="h-6 bg-gray-100 rounded w-1/2 mx-auto" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto" />
              </div>
            ) : (
              <>
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                  <s.icon size={16} className={s.color} />
                </div>
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Triggered alert banner ────────────────────────────────────────── */}
      {!isLoading && triggered.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">
              🎉 {triggered.length} รายการถึงราคาเป้าหมายแล้ว!
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              คลิกที่สินค้าเพื่อเปรียบเทียบราคาและไปซื้อ
            </p>
          </div>
          <button
            onClick={() => setAlertTab("triggered")}
            className="text-xs font-semibold text-green-700 border border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors shrink-0"
          >
            ดูทั้งหมด
          </button>
        </div>
      )}

      {/* ── Main Tab Bar ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {([
          { key: "alerts",   label: "🔔 การแจ้งเตือน", badge: triggered.length },
          { key: "wishlist", label: "❤️ รายการโปรด",   badge: wishlist.length },
          { key: "settings", label: "⚙️ ตั้งค่า",       badge: 0 },
        ] as { key: MainTab; label: string; badge: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mainTab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                mainTab === t.key ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Alerts card ───────────────────────────────────────────────────── */}
      {mainTab === "alerts" && <div className="card overflow-hidden">
        {/* Header + tabs */}
        <div className="px-5 pt-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-blue-500" />
              <h2 className="font-bold text-gray-900">การแจ้งเตือนราคา</h2>
            </div>
            <Link
              to="/"
              className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
            >
              <Package size={12} /> เพิ่มสินค้า
            </Link>
          </div>
          {/* Tab bar */}
          <div className="flex gap-1">
            {alertTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setAlertTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                  alertTab === t.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      alertTab === t.key
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-20 h-6 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">
              {alertTab === "triggered"
                ? "ยังไม่มีรายการที่ถึงเป้า"
                : alertTab === "pending"
                ? "ไม่มีรายการที่รออยู่"
                : "ยังไม่มีการแจ้งเตือน"}
            </p>
            {alertTab === "all" && (
              <Link
                to="/"
                className="text-blue-600 text-sm hover:underline mt-2 inline-flex items-center gap-1"
              >
                <TrendingDown size={13} /> เลือกสินค้าที่ต้องการติดตามราคา
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {displayed.map((alert) => {
              const currentPrice = alert.product?.minPrice ?? 0;
              const isTriggered = alert.triggered;

              return (
                <div
                  key={alert._id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                    isTriggered ? "bg-green-50/40" : "hover:bg-gray-50/50"
                  }`}
                >
                  {/* Product image */}
                  <img
                    src={proxyImage(alert.product?.image)}
                    alt={alert.product?.nameTh}
                    className="w-12 h-12 rounded-xl object-contain bg-white border border-gray-100 p-1 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder-product.svg";
                      (e.target as HTMLImageElement).onerror = null;
                    }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${alert.product?._id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate block"
                    >
                      {alert.product?.nameTh}
                    </Link>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>
                        เป้า{" "}
                        <span className="font-bold text-blue-600">
                          ฿{alert.targetPrice.toLocaleString()}
                        </span>
                      </span>
                      {currentPrice > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>
                            ปัจจุบัน{" "}
                            <span
                              className={`font-bold ${
                                currentPrice <= alert.targetPrice
                                  ? "text-green-600"
                                  : "text-gray-700"
                              }`}
                            >
                              ฿{currentPrice.toLocaleString()}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                    <PriceDiffBar current={currentPrice} target={alert.targetPrice} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isTriggered ? (
                      <Link
                        to={`/product/${alert.product?._id}`}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ดูราคา <ArrowUpRight size={11} />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium">
                        <Clock size={11} /> รอลด
                      </span>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(alert._id)}
                      disabled={deleteMutation.isPending}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      title="ลบการแจ้งเตือน"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* ── Wishlist ──────────────────────────────────────────────────────── */}
      {mainTab === "wishlist" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-red-500 fill-red-500" />
              <h2 className="font-bold text-gray-900">รายการโปรด</h2>
            </div>
            <span className="badge bg-red-100 text-red-700">{wishlist.length} รายการ</span>
          </div>

          {loadingWl ? (
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="aspect-square bg-gray-100 rounded-xl" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-5 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : wishlist.length === 0 ? (
            <div className="py-14 text-center">
              <Heart size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">ยังไม่มีรายการโปรด</p>
              <Link to="/" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                เลือกสินค้าที่ชอบ →
              </Link>
            </div>
          ) : (
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {wishlist.map((p) => (
                <div key={p._id} className="relative group">
                  <ProductCard product={p} />
                  <button
                    onClick={() => removeWlMutation.mutate(p._id)}
                    className="absolute top-2 right-2 z-10 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="นำออก"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings ──────────────────────────────────────────────────────── */}
      {mainTab === "settings" && (
        <div className="space-y-4">
          {/* LINE Notify */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle size={18} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">LINE Notify</h3>
                <p className="text-xs text-gray-500">รับแจ้งเตือนราคาผ่าน LINE ทันที</p>
              </div>
              {lineConnected && (
                <span className="ml-auto badge bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle size={11} /> เชื่อมต่อแล้ว
                </span>
              )}
            </div>

            {lineConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 bg-green-50 rounded-xl px-4 py-3 border border-green-100">
                  ✅ LINE Notify เชื่อมต่อแล้ว — คุณจะได้รับแจ้งเตือนเมื่อราคาถึงเป้าหมาย
                </p>
                <button
                  onClick={() => lineTokenMutation.mutate("")}
                  disabled={lineTokenMutation.isPending}
                  className="text-sm text-red-500 hover:text-red-600 hover:underline"
                >
                  ยกเลิกการเชื่อมต่อ
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside bg-gray-50 rounded-xl px-4 py-3">
                  <li>ไปที่ <a href="https://notify-bot.line.me/th/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">notify-bot.line.me <ExternalLink size={10} /></a></li>
                  <li>Login → "Generate token" → ตั้งชื่อ "PriceCompare"</li>
                  <li>เลือก "1-on-1 chat with LINE Notify" → Generate</li>
                  <li>Copy token มาวางด้านล่าง</li>
                </ol>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lineToken}
                    onChange={(e) => setLineToken(e.target.value)}
                    placeholder="วาง LINE Notify Token ที่นี่..."
                    className="input flex-1 text-sm font-mono"
                  />
                  <button
                    onClick={() => lineTokenMutation.mutate(lineToken.trim())}
                    disabled={!lineToken.trim() || lineTokenMutation.isPending}
                    className="btn-primary shrink-0 text-sm"
                  >
                    {lineTokenMutation.isPending ? "กำลังตรวจสอบ..." : "เชื่อมต่อ"}
                  </button>
                </div>
                {lineMsg && (
                  <p className={`text-sm ${lineMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                    {lineMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Email notifications */}
          <EmailNotificationCard email={user?.email ?? ""} />

          {/* Account info */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User size={15} className="text-gray-400" /> ข้อมูลบัญชี
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ชื่อ</span>
                <span className="font-medium text-gray-900">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">อีเมล</span>
                <span className="font-medium text-gray-900">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ประเภทบัญชี</span>
                <span className="font-medium text-gray-900 capitalize">{user?.role}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
