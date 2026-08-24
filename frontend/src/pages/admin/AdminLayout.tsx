import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Package, FileText,
  LogOut, ShoppingBag, ChevronRight, Zap, Activity, Tag, BarChart3,
  X, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scraperApi } from "../../api";
import { useState, useEffect } from "react";

interface ScraperProgress {
  isRunning:      boolean;
  total:          number;
  done:           number;
  failed:         number;
  currentProduct: string;
  startedAt:      string | null;
  finishedAt:     string | null;
}

const navItems = [
  { to: "/admin",             label: "ภาพรวม",        icon: LayoutDashboard, end: true },
  { to: "/admin/analytics",   label: "Analytics",     icon: BarChart3 },
  { to: "/admin/users",       label: "ผู้ใช้งาน",      icon: Users },
  { to: "/admin/products",    label: "สินค้า",         icon: Package },
  { to: "/admin/monitor",     label: "Monitor",        icon: Activity },
  { to: "/admin/categories",  label: "หมวดหมู่",       icon: Tag },
  { to: "/admin/logs",        label: "การแจ้งเตือน",   icon: FileText },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin":            "ภาพรวมระบบ",
  "/admin/analytics":  "Analytics",
  "/admin/users":      "ผู้ใช้งาน",
  "/admin/products":   "สินค้า",
  "/admin/monitor":    "Monitor ระบบ",
  "/admin/categories": "หมวดหมู่",
  "/admin/logs":       "การแจ้งเตือน",
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isPolling,     setIsPolling]     = useState(false);
  const [showProgress,  setShowProgress]  = useState(false);
  const [scrapeError,   setScrapeError]   = useState("");

  const currentTitle = PAGE_TITLES[location.pathname] ?? "Admin";

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  // ── Poll progress every 2 s while scraping ─────────────────────────────────
  const { data: progressData } = useQuery({
    queryKey: ["scraper-progress"],
    queryFn:  () => scraperApi.getProgress(),
    enabled:  isPolling,
    refetchInterval: isPolling ? 2_000 : false,
  });
  const progress: ScraperProgress | null = progressData?.data ?? null;

  // Stop polling when scraper finishes, refresh data
  useEffect(() => {
    if (!progress) return;
    if (!progress.isRunning && progress.done > 0 && isPolling) {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-scraper-status"] });
    }
  }, [progress, isPolling]); // eslint-disable-line

  const scrapeAllMutation = useMutation({
    mutationFn: scraperApi.updateAll,
    onSuccess: () => {
      setScrapeError("");
      setShowProgress(true);
      // Small delay so backend has time to initialize scraperProgress
      setTimeout(() => setIsPolling(true), 800);
    },
    onError: () => setScrapeError("❌ เกิดข้อผิดพลาด"),
  });

  // Derived progress values
  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
  const isDone = !!progress && !progress.isRunning && progress.done > 0;

  // Elapsed time string (mm:ss)
  const elapsed = (() => {
    if (!progress?.startedAt) return "";
    const ref = isDone && progress.finishedAt ? progress.finishedAt : new Date().toISOString();
    const diff = Math.floor((new Date(ref).getTime() - new Date(progress.startedAt).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  })();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShoppingBag size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-none">PriceCompare</p>
            <p className="text-slate-400 text-xs">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Scrape All shortcut */}
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              if (isPolling) { setShowProgress(true); return; }
              if (!confirm("อัพเดทราคาทุกสินค้าจากทุกแพลตฟอร์ม?\n(ใช้เวลาหลายนาที)")) return;
              scrapeAllMutation.mutate();
            }}
            disabled={scrapeAllMutation.isPending}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors disabled:opacity-50"
          >
            <Zap size={15} className={(scrapeAllMutation.isPending || isPolling) ? "animate-pulse" : ""} />
            {isPolling
              ? `กำลัง scrape... ${pct}%`
              : scrapeAllMutation.isPending
              ? "กำลังเริ่ม..."
              : "อัพเดทราคาทั้งหมด"}
          </button>
          {scrapeError && (
            <p className="text-xs text-red-400 mt-1.5 px-1">{scrapeError}</p>
          )}
        </div>

        {/* User info + logout */}
        <div className="px-3 pb-4 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2.5 px-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-slate-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-red-400 rounded-xl text-sm transition-colors"
          >
            <LogOut size={15} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-2 sticky top-0 z-10">
          <span className="text-xs text-gray-400">Admin</span>
          <ChevronRight size={13} className="text-gray-300" />
          <span className="text-sm text-gray-700 font-medium">{currentTitle}</span>
          <div className="ml-auto">
            <span className="badge bg-blue-100 text-blue-700 text-xs">Admin</span>
          </div>
        </div>

        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* ── Scrape Progress Panel (floating bottom-right) ────────────────────── */}
      {showProgress && progress && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

          {/* Header bar with gradient */}
          <div className={`px-5 pt-4 pb-3 ${isDone && progress.failed === 0 ? "bg-gradient-to-r from-green-500 to-emerald-500" : isDone ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-blue-600 to-blue-500"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isDone
                  ? progress.failed === 0
                    ? <CheckCircle2 size={15} className="text-white" />
                    : <AlertCircle size={15} className="text-white" />
                  : <Zap size={15} className="text-white animate-pulse" />
                }
                <p className="text-white text-sm font-semibold">
                  {isDone ? "อัพเดทเสร็จสมบูรณ์" : "กำลังอัพเดทราคา..."}
                </p>
              </div>
              {isDone && (
                <button
                  onClick={() => setShowProgress(false)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Percentage + count */}
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-white/80 text-xs font-semibold">{pct}%</span>
              <span className="text-white/80 text-xs">
                {progress.done}/{progress.total} สินค้า
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-3 space-y-2">
            {/* Current product */}
            {progress.isRunning && progress.currentProduct && (
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mt-1.5 shrink-0" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  กำลังดึงราคา:{" "}
                  <span className="font-semibold text-gray-900">{progress.currentProduct}</span>
                </p>
              </div>
            )}

            {/* Done summary */}
            {isDone && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 size={12} />
                  <span>สำเร็จ {progress.done - progress.failed} รายการ</span>
                </div>
                {progress.failed > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertCircle size={12} />
                    <span>พบข้อผิดพลาด {progress.failed} รายการ</span>
                  </div>
                )}
              </div>
            )}

            {/* Elapsed time */}
            {elapsed && (
              <p className="text-[11px] text-gray-400">
                {isDone ? "ใช้เวลาทั้งหมด" : "เวลาที่ผ่านไป"}: {elapsed}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
