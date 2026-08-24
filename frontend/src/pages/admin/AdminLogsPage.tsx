import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { proxyImage } from "../../utils/imageUrl";
import {
  Bell, CheckCircle, Clock, Search, Filter,
  TrendingDown, User, Package, AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";

interface AdminAlert {
  _id: string;
  user: { name: string; email: string } | null;
  product: { nameTh: string; name?: string; image: string; minPrice: number } | null;
  targetPrice: number;
  triggered: boolean;
  createdAt: string;
}

type FilterStatus = "all" | "pending" | "triggered";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

export default function AdminLogsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  const { data, isLoading } = useQuery<{ data: AdminAlert[] }>({
    queryKey: ["admin-alerts"],
    queryFn: () => adminApi.getAlerts(),
    refetchInterval: 60_000,
  });

  const alerts: AdminAlert[] = data?.data ?? [];

  const stats = useMemo(() => ({
    total: alerts.length,
    triggered: alerts.filter((a) => a.triggered).length,
    pending: alerts.filter((a) => !a.triggered).length,
  }), [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filter === "pending" && a.triggered) return false;
      if (filter === "triggered" && !a.triggered) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const productName = (a.product?.nameTh ?? a.product?.name ?? "").toLowerCase();
        const userName = (a.user?.name ?? "").toLowerCase();
        const userEmail = (a.user?.email ?? "").toLowerCase();
        return productName.includes(q) || userName.includes(q) || userEmail.includes(q);
      }
      return true;
    });
  }, [alerts, filter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">การแจ้งเตือนราคา</h1>
        <p className="text-gray-500 text-sm mt-0.5">รายการแจ้งเตือนราคาของผู้ใช้ทั้งหมด</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "ทั้งหมด",
            value: stats.total,
            icon: Bell,
            color: "bg-blue-50",
            ring: "bg-blue-100",
            iconCls: "text-blue-600",
            click: () => setFilter("all"),
            active: filter === "all",
          },
          {
            label: "รอดำเนินการ",
            value: stats.pending,
            icon: Clock,
            color: "bg-amber-50",
            ring: "bg-amber-100",
            iconCls: "text-amber-600",
            click: () => setFilter("pending"),
            active: filter === "pending",
          },
          {
            label: "แจ้งเตือนแล้ว",
            value: stats.triggered,
            icon: CheckCircle,
            color: "bg-green-50",
            ring: "bg-green-100",
            iconCls: "text-green-600",
            click: () => setFilter("triggered"),
            active: filter === "triggered",
          },
        ].map((s) => (
          <button
            key={s.label}
            onClick={s.click}
            className={`card p-5 text-left transition-all hover:shadow-md ${
              s.active ? "ring-2 ring-blue-400 ring-offset-1" : ""
            }`}
          >
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-10 w-10 bg-gray-100 rounded-xl" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-7 bg-gray-100 rounded w-1/3" />
              </div>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.ring}`}>
                  <s.icon size={18} className={s.iconCls} />
                </div>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-3xl font-extrabold text-gray-900">{s.value.toLocaleString()}</p>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาสินค้า หรือ ผู้ใช้..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-1 py-1">
          <Filter size={13} className="text-gray-400 ml-2" />
          {(["all", "pending", "triggered"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f === "all" ? "ทั้งหมด" : f === "pending" ? "รอดำเนินการ" : "แจ้งแล้ว"}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} รายการ
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-24 h-3 bg-gray-100 rounded" />
                <div className="w-16 h-6 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">ไม่พบรายการแจ้งเตือน</p>
            {search && (
              <p className="text-gray-400 text-sm mt-1">
                ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="flex items-center gap-1.5"><Package size={11} /> สินค้า</div>
              <div className="flex items-center gap-1.5"><User size={11} /> ผู้ใช้</div>
              <div className="flex items-center gap-1.5"><TrendingDown size={11} /> ราคาเป้าหมาย</div>
              <div>ราคาปัจจุบัน</div>
              <div>สถานะ</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {filtered.map((a) => {
                const currentPrice = a.product?.minPrice ?? 0;
                const diff = currentPrice - a.targetPrice;
                const pct = a.targetPrice > 0
                  ? Math.round((Math.abs(diff) / a.targetPrice) * 100)
                  : 0;

                return (
                  <div
                    key={a._id}
                    className="px-5 py-3.5 grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 items-center hover:bg-gray-50/60 transition-colors"
                  >
                    {/* Product */}
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={proxyImage(a.product?.image ?? "")}
                        alt=""
                        className="w-10 h-10 object-contain rounded-xl bg-gray-50 shrink-0 border border-gray-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder-product.svg";
                          (e.target as HTMLImageElement).onerror = null;
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                          {a.product?.nameTh ?? a.product?.name ?? "—"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {timeAgo(a.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* User */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {a.user?.name ?? "—"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{a.user?.email ?? ""}</p>
                    </div>

                    {/* Target price */}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        ฿{a.targetPrice.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(a.createdAt)}</p>
                    </div>

                    {/* Current min price */}
                    <div>
                      {currentPrice > 0 ? (
                        <>
                          <p
                            className={`text-sm font-semibold ${
                              currentPrice <= a.targetPrice
                                ? "text-green-600"
                                : "text-gray-700"
                            }`}
                          >
                            ฿{currentPrice.toLocaleString()}
                          </p>
                          <p
                            className={`text-xs mt-0.5 ${
                              diff <= 0 ? "text-green-500" : "text-red-400"
                            }`}
                          >
                            {diff <= 0 ? `↓ ${pct}%` : `↑ ${pct}%`} จากเป้า
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">—</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      {a.triggered ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium whitespace-nowrap">
                          <CheckCircle size={11} />
                          แจ้งแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium whitespace-nowrap">
                          <Clock size={11} />
                          รอดำเนินการ
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
