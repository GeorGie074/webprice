import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsApi } from "../api";
import { Alert } from "../types";
import { Bell, Trash2, CheckCircle, Clock, User, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function UserDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: alertsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const alerts: Alert[] = data?.data ?? [];
  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="card p-6 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-blue-500/20">
          {user?.name[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{user?.name}</h1>
          <p className="text-gray-500 text-sm">{user?.email}</p>
          <span className={`badge mt-1 ${user?.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {user?.role === "admin" ? <><Shield size={11} className="inline mr-1" />Admin</> : <><User size={11} className="inline mr-1" />สมาชิก</>}
          </span>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-blue-500" />
            <h2 className="font-bold text-gray-900">การแจ้งเตือนราคา</h2>
          </div>
          <span className="badge bg-blue-100 text-blue-700">{activeAlerts.length} ใช้งาน</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">ยังไม่มีการแจ้งเตือน</p>
            <Link to="/" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              เลือกสินค้าที่ต้องการติดตามราคา →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {alerts.map((alert) => (
              <div key={alert._id} className={`flex items-center gap-4 px-6 py-4 ${alert.triggered ? "bg-green-50/50" : ""}`}>
                <img src={alert.product?.image} alt={alert.product?.nameTh}
                  className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-100 p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/100?text=?"; }}
                />
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${alert.product?._id}`}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate block">
                    {alert.product?.nameTh}
                  </Link>
                  <div className="flex items-center gap-3 mt-0.5 text-sm">
                    <span className="text-gray-500">
                      เป้าหมาย: <span className="font-semibold text-blue-600">฿{alert.targetPrice.toLocaleString()}</span>
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-500">
                      ราคาปัจจุบัน: <span className="font-semibold">฿{alert.product?.minPrice?.toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {alert.triggered ? (
                    <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
                      <CheckCircle size={11} /> ถึงแล้ว!
                    </span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1">
                      <Clock size={11} /> รอราคาลด
                    </span>
                  )}
                  <button onClick={() => deleteMutation.mutate(alert._id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {triggeredAlerts.length > 0 && (
          <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-xs text-green-700 flex items-center gap-1.5">
            <CheckCircle size={12} />
            {triggeredAlerts.length} รายการถึงราคาเป้าหมายแล้ว! คลิกที่สินค้าเพื่อดูราคาปัจจุบัน
          </div>
        )}
      </div>
    </div>
  );
}
