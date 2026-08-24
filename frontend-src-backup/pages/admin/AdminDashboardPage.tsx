import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { Users, Package, Bell, RefreshCw, CheckCircle } from "lucide-react";
import { useState } from "react";

interface Stats { users: number; products: number; alerts: number; }

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [seedMsg, setSeedMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
  });

  const seedMutation = useMutation({
    mutationFn: adminApi.seed,
    onSuccess: (res) => {
      setSeedMsg(`✅ ${res.data.message}`);
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setTimeout(() => setSeedMsg(""), 5000);
    },
    onError: () => setSeedMsg("❌ Seed ล้มเหลว"),
  });

  const stats: Stats = data?.data ?? { users: 0, products: 0, alerts: 0 };

  const statCards = [
    { label: "ผู้ใช้งานทั้งหมด", value: stats.users, icon: Users, color: "blue" },
    { label: "สินค้าทั้งหมด", value: stats.products, icon: Package, color: "purple" },
    { label: "การแจ้งเตือนราคา", value: stats.alerts, icon: Bell, color: "amber" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    amber: "bg-amber-100 text-amber-600",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ภาพรวมระบบ</h1>
          <p className="text-gray-500 text-sm mt-0.5">สถิติและข้อมูลสรุปของระบบ</p>
        </div>

        {/* Seed button */}
        <div className="flex items-center gap-3">
          {seedMsg && (
            <p className="text-sm text-green-700 flex items-center gap-1">
              <CheckCircle size={14} /> {seedMsg}
            </p>
          )}
          <button
            onClick={() => {
              if (confirm("⚠️ Seed จะล้างข้อมูลเดิมทั้งหมดและใส่ข้อมูลตัวอย่าง ยืนยันหรือไม่?")) {
                seedMutation.mutate();
              }
            }}
            disabled={seedMutation.isPending}
            className="btn-outline !py-2 !px-4 !text-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={seedMutation.isPending ? "animate-spin" : ""} />
            {seedMutation.isPending ? "กำลัง Seed..." : "Seed ข้อมูลตัวอย่าง"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="card p-6">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-8 bg-gray-100 rounded w-1/3" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[s.color]}`}>
                    <s.icon size={18} />
                  </div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
                <p className="text-3xl font-extrabold text-gray-900">{s.value.toLocaleString()}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="card p-6 bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2">🚀 วิธีเริ่มใช้งาน</h3>
        <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
          <li>กด <strong>Seed ข้อมูลตัวอย่าง</strong> เพื่อเพิ่มข้อมูลทดสอบ</li>
          <li>ข้อมูล seed จะสร้าง admin (admin@webprice.com / admin1234) และ user ตัวอย่าง</li>
          <li>ไปที่เมนู <strong>สินค้า</strong> เพื่อจัดการสินค้าและราคา</li>
          <li>ไปที่เมนู <strong>ผู้ใช้งาน</strong> เพื่อจัดการ role ของผู้ใช้</li>
        </ol>
      </div>
    </div>
  );
}
