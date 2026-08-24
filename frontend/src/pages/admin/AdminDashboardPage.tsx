import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { proxyImage } from "../../utils/imageUrl";
import {
  Users, Package, Bell, RefreshCw, CheckCircle, Clock,
  TrendingDown, AlertCircle, Search, ShoppingBag, TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

interface Stats {
  users: number;
  products: number;
  alerts: number;
  triggeredAlerts: number;
  lastScraped: string | null;
  todaySearches: number;
  topSearches: Array<{ query: string; count: number }>;
  marketplaces: string[];
}

interface AdminAlert {
  _id: string;
  user: { name: string; email: string };
  product: { nameTh: string; image: string; minPrice: number };
  targetPrice: number;
  triggered: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} วันที่แล้ว`;
  if (h > 0) return `${h} ชั่วโมงที่แล้ว`;
  if (m > 0) return `${m} นาทีที่แล้ว`;
  return "เมื่อกี้";
}

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [seedMsg, setSeedMsg] = useState("");

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    refetchInterval: 30_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => adminApi.getAlerts(),
  });

  const seedMutation = useMutation({
    mutationFn: adminApi.seed,
    onSuccess: (res) => {
      setSeedMsg(`✅ ${res.data.message}`);
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setTimeout(() => setSeedMsg(""), 6000);
    },
    onError: () => setSeedMsg("❌ Seed ล้มเหลว"),
  });

  const stats: Stats = statsData?.data ?? {
    users: 0, products: 0, alerts: 0, triggeredAlerts: 0,
    lastScraped: null, todaySearches: 0, topSearches: [], marketplaces: [],
  };
  const recentAlerts: AdminAlert[] = (alertsData?.data ?? []).slice(0, 6);

  const statCards = [
    {
      label: "ผู้ใช้งาน", value: stats.users, icon: Users, color: "blue", link: "/admin/users",
      delta: "+1 วันนี้", deltaUp: true,
    },
    {
      label: "สินค้าทั้งหมด", value: stats.products, icon: Package, color: "purple", link: "/admin/products",
      delta: `${stats.products} รายการ`, deltaUp: true,
    },
    {
      label: "ค้นหาวันนี้", value: stats.todaySearches, icon: Search, color: "teal", link: "/admin",
      delta: stats.todaySearches > 0 ? "Live" : "ยังไม่มีข้อมูล", deltaUp: stats.todaySearches > 0,
    },
    {
      label: "การแจ้งเตือนทั้งหมด", value: stats.alerts, icon: Bell, color: "amber", link: "/admin/logs",
      delta: stats.triggeredAlerts > 0 ? `${stats.triggeredAlerts} triggered` : "ทั้งหมด",
      deltaUp: stats.triggeredAlerts > 0,
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string; ring: string; bar: string }> = {
    blue:   { bg: "bg-blue-50",   icon: "text-blue-600",   ring: "bg-blue-100",   bar: "bg-blue-500"   },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", ring: "bg-purple-100", bar: "bg-purple-500" },
    teal:   { bg: "bg-teal-50",   icon: "text-teal-600",   ring: "bg-teal-100",   bar: "bg-teal-500"   },
    amber:  { bg: "bg-amber-50",  icon: "text-amber-600",  ring: "bg-amber-100",  bar: "bg-amber-500"  },
    green:  { bg: "bg-green-50",  icon: "text-green-600",  ring: "bg-green-100",  bar: "bg-green-500"  },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ภาพรวมระบบ</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {stats.lastScraped
              ? <>อัพเดทราคาล่าสุด: <span className="font-medium text-gray-700">{timeAgo(stats.lastScraped)}</span></>
              : "ยังไม่เคย scrape"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {seedMsg && (
            <p className="text-sm text-green-700 flex items-center gap-1.5">
              <CheckCircle size={14} /> {seedMsg}
            </p>
          )}
          <button
            onClick={() => {
              if (confirm("⚠️ Seed จะล้างข้อมูลเดิมทั้งหมดและใส่ข้อมูลตัวอย่าง ยืนยันหรือไม่?"))
                seedMutation.mutate();
            }}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={14} className={seedMutation.isPending ? "animate-spin" : ""} />
            {seedMutation.isPending ? "กำลัง Seed..." : "Seed ข้อมูลตัวอย่าง"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const c = colorMap[s.color];
          return (
            <Link
              key={s.label}
              to={s.link}
              className="card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden relative"
            >
              {/* colored top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${c.bar} opacity-60 group-hover:opacity-100 transition-opacity`} />

              {loadingStats ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-10 w-10 bg-gray-100 rounded-xl" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-7 bg-gray-100 rounded w-1/3" />
                </div>
              ) : (
                <>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.ring}`}>
                    <s.icon size={18} className={c.icon} />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-extrabold text-gray-900 leading-none">{s.value.toLocaleString()}</p>
                  </div>
                  {/* Delta indicator */}
                  <p className={`text-xs mt-1.5 font-semibold flex items-center gap-1 ${
                    s.deltaUp ? "text-green-600" : "text-gray-400"
                  }`}>
                    {s.deltaUp ? (
                      <TrendingUp size={11} className="shrink-0" />
                    ) : (
                      <AlertCircle size={11} className="shrink-0" />
                    )}
                    {s.delta}
                  </p>
                </>
              )}
            </Link>
          );
        })}
      </div>

      {/* Last scraped time indicator */}
      {stats.lastScraped && (
        <div className="flex items-center gap-2 text-xs text-gray-400 -mt-2">
          <Clock size={12} />
          <span>
            ราคาถูก scrape ล่าสุดเมื่อ{" "}
            {new Date(stats.lastScraped).toLocaleString("th-TH", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
      )}

      {/* Marketplace section */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag size={16} className="text-blue-500" />
          <h3 className="font-semibold text-gray-900">
            Marketplace ที่เชื่อมต่อ
            <span className="ml-2 text-sm text-gray-400 font-normal">
              ({stats.marketplaces.length} แพลตฟอร์ม)
            </span>
          </h3>
          <Link to="/admin/monitor" className="ml-auto text-xs text-blue-600 font-medium hover:underline">
            ดูสถานะ →
          </Link>
        </div>
        {loadingStats ? (
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {stats.marketplaces.map((plat) => (
              <span
                key={plat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700"
              >
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                {plat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom row: alerts + top searches + quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Price Alerts */}
        <div className="card overflow-hidden lg:col-span-1">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              <h3 className="font-semibold text-gray-900">การแจ้งเตือนล่าสุด</h3>
            </div>
            <Link to="/admin/logs" className="text-xs text-blue-600 font-medium hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          {recentAlerts.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">ยังไม่มีการแจ้งเตือน</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentAlerts.map((a) => (
                <div key={a._id} className="px-5 py-3 flex items-center gap-3">
                  <img
                    src={proxyImage(a.product?.image)}
                    alt=""
                    className="w-8 h-8 object-contain rounded-lg bg-gray-50 shrink-0 border border-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.product?.nameTh}</p>
                    <p className="text-xs text-gray-400">{a.user?.name} — เป้าหมาย ฿{a.targetPrice.toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {a.triggered ? (
                      <span className="badge bg-green-100 text-green-700 text-xs flex items-center gap-1">
                        <CheckCircle size={10} /> แจ้งแล้ว
                      </span>
                    ) : (
                      <span className="badge bg-yellow-100 text-yellow-700 text-xs flex items-center gap-1">
                        <Clock size={10} /> รอ
                      </span>
                    )}
                    <p className="text-xs text-gray-300 mt-0.5">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Searches */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal-500" />
            <h3 className="font-semibold text-gray-900">ค้นหายอดนิยม</h3>
          </div>
          {loadingStats ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
              ))}
            </div>
          ) : stats.topSearches.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลการค้นหา</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.topSearches.slice(0, 8).map((s, i) => (
                <div key={s.query} className="px-5 py-2.5 flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 text-center ${
                    i === 0 ? "text-amber-500" : i === 1 ? "text-gray-500" : i === 2 ? "text-orange-400" : "text-gray-300"
                  }`}>#{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700 truncate font-medium">{s.query}</span>
                  <span className="text-xs text-gray-400 font-medium shrink-0">{s.count} ครั้ง</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingDown size={16} className="text-blue-500" /> ลิงก์ด่วน
            </h3>
            <div className="space-y-2">
              {[
                { to: "/admin/products",   label: "จัดการสินค้า",     desc: `${stats.products} รายการ`                              },
                { to: "/admin/users",      label: "จัดการผู้ใช้",     desc: `${stats.users} บัญชี`                                  },
                { to: "/admin/monitor",    label: "Monitor ระบบ",     desc: `${stats.marketplaces.length} แพลตฟอร์ม`               },
                { to: "/admin/categories", label: "จัดการหมวดหมู่",   desc: "6 หมวดหมู่"                                             },
                { to: "/admin/logs",       label: "ดูการแจ้งเตือน",   desc: `${stats.alerts - stats.triggeredAlerts} รอดำเนินการ`   },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{item.label}</span>
                  <span className="text-xs text-gray-400 group-hover:text-blue-500">{item.desc}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5 bg-blue-50 border-blue-100">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">Scrape ราคา</p>
                <p className="text-xs text-blue-700">ใช้ปุ่ม "อัพเดทราคาทั้งหมด" ใน sidebar เพื่อดึงราคาจากทุกร้านค้า</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
