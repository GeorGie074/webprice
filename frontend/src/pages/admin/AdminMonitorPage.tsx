import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, HelpCircle } from "lucide-react";
import { PlatformLogo } from "../../components/ui/PlatformLogo";

interface PlatformStatus {
  platform: string;
  lastScraped: string | null;
  status: "online" | "delay" | "offline" | "unknown";
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

const STATUS_CONFIG = {
  online:  { label: "ออนไลน์",     icon: CheckCircle,    bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  },
  delay:   { label: "ล่าช้า",       icon: AlertTriangle,  bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500"  },
  offline: { label: "ออฟไลน์",     icon: XCircle,        bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-400"    },
  unknown: { label: "ยังไม่ทราบ",  icon: HelpCircle,     bg: "bg-gray-50",   text: "text-gray-500",   dot: "bg-gray-300"   },
};


export default function AdminMonitorPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["admin-scraper-status"],
    queryFn: () => adminApi.getScraperStatus(),
    refetchInterval: 60_000,
  });

  const statuses: PlatformStatus[] = data?.data ?? [];

  const counts = {
    online:  statuses.filter((s) => s.status === "online").length,
    delay:   statuses.filter((s) => s.status === "delay").length,
    offline: statuses.filter((s) => s.status === "offline").length,
    unknown: statuses.filter((s) => s.status === "unknown").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitor ระบบดึงข้อมูล</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            สถานะการดึงราคาของแต่ละแพลตฟอร์ม
            {dataUpdatedAt > 0 && (
              <> · อัพเดทล่าสุด {timeAgo(new Date(dataUpdatedAt).toISOString())}</>
            )}
          </p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-scraper-status"] })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
        >
          <RefreshCw size={14} />
          รีเฟรช
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["online", "delay", "offline", "unknown"] as const).map((key) => {
          const cfg = STATUS_CONFIG[key];
          return (
            <div key={key} className={`card p-4 ${cfg.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <cfg.icon size={16} className={cfg.text} />
                <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
              </div>
              <p className={`text-3xl font-extrabold ${cfg.text}`}>{counts[key]}</p>
              <p className="text-xs text-gray-400 mt-0.5">แพลตฟอร์ม</p>
            </div>
          );
        })}
      </div>

      {/* Platform table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">รายละเอียดแต่ละแพลตฟอร์ม</p>
          <p className="text-xs text-gray-400 mt-0.5">
            สถานะคำนวณจากเวลา scrape ล่าสุด · ออนไลน์ = scrape ภายใน 25 ชม. · ล่าช้า = 25–72 ชม. · ออฟไลน์ = มากกว่า 72 ชม.
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-20 h-6 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">ไม่มีข้อมูลสถานะ</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {statuses.map((s) => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <div key={s.platform} className="px-6 py-4 flex items-center gap-4">
                  {/* Platform logo */}
                  <div className="shrink-0">
                    <PlatformLogo platform={s.platform} size={40} />
                  </div>

                  {/* Platform info */}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{s.platform}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {s.lastScraped
                        ? <>Scrape ล่าสุด: {timeAgo(s.lastScraped)} ({new Date(s.lastScraped).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })})</>
                        : "ยังไม่เคย scrape"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} ${s.status === "online" ? "animate-pulse" : ""}`} />
                    {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="card p-5 bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2">วิธีอ่านสถานะ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { status: "online",  desc: "Scrape ล่าสุดภายใน 25 ชั่วโมงที่ผ่านมา — ระบบทำงานปกติ" },
            { status: "delay",   desc: "Scrape ล่าสุด 25–72 ชั่วโมงที่แล้ว — ราคาอาจล้าสมัย" },
            { status: "offline", desc: "ไม่มีการ scrape มากกว่า 72 ชั่วโมง — ต้องตรวจสอบ" },
            { status: "unknown", desc: "ยังไม่มีข้อมูล — กด 'อัพเดทราคาทั้งหมด' ใน sidebar ก่อน" },
          ].map(({ status, desc }) => {
            const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            return (
              <div key={status} className="flex items-start gap-2">
                <cfg.icon size={14} className={`${cfg.text} mt-0.5 shrink-0`} />
                <p className="text-blue-800 text-xs">{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
