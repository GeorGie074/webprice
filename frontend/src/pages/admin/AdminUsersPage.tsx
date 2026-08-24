import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { proxyImage } from "../../utils/imageUrl";
import {
  Trash2, Shield, User, Ban, Activity, X,
  Search, Heart, Clock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  suspended: boolean;
  createdAt: string;
}

interface BehaviorData {
  user: AdminUser & { wishlist?: any[]; searchHistory?: Array<{ query: string; at: string }> };
  recentSearches: Array<{ query: string; createdAt: string }>;
  wishlist: Array<{ _id: string; nameTh: string; name: string; image: string; minPrice: number; category: string }>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} วันที่แล้ว`;
  if (h > 0) return `${h} ชม.`;
  if (m > 0) return `${m} นาที`;
  return "เมื่อกี้";
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [behaviorUserId, setBehaviorUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.getUsers(),
  });

  const { data: behaviorData, isLoading: loadingBehavior } = useQuery<{ data: BehaviorData }>({
    queryKey: ["admin-user-behavior", behaviorUserId],
    queryFn: () => adminApi.getUserBehavior(behaviorUserId!),
    enabled: !!behaviorUserId,
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.setRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const suspendMutation = useMutation({
    mutationFn: adminApi.suspendUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const users: AdminUser[] = data?.data ?? [];
  const behavior: BehaviorData | undefined = behaviorData?.data;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ผู้ใช้งาน</h1>
          <p className="text-gray-500 text-sm">จัดการบัญชีผู้ใช้ทั้งหมด ({users.length} บัญชี)</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div>
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4">
              {["ชื่อ / อีเมล", "Role", "สมัครเมื่อ", ""].map((h) => (
                <div key={h} className="h-3 bg-gray-100 rounded w-16 animate-pulse" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-3 animate-pulse border-b border-gray-50">
                <div className="w-9 h-9 bg-gray-100 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-16 h-5 bg-gray-100 rounded-full" />
                <div className="w-20 h-3 bg-gray-100 rounded hidden md:block" />
                <div className="w-24 h-7 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">ชื่อ / อีเมล</th>
                <th className="text-center px-4 py-3 font-medium">Role</th>
                <th className="text-center px-4 py-3 font-medium">สถานะ</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">สมัครเมื่อ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u._id} className={`hover:bg-gray-50 transition-colors ${u.suspended ? "opacity-60" : ""}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        u.suspended ? "bg-gray-300 text-gray-500" :
                        u.role === "admin" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{u.name}</p>
                        <p className="text-gray-400 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`badge ${u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {u.role === "admin"
                        ? <><Shield size={10} className="inline mr-1" />Admin</>
                        : <><User size={10} className="inline mr-1" />User</>}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {u.suspended ? (
                      <span className="badge bg-red-100 text-red-600 text-xs flex items-center justify-center gap-1">
                        <Ban size={10} /> ระงับแล้ว
                      </span>
                    ) : (
                      <span className="badge bg-green-100 text-green-600 text-xs">ปกติ</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-400 text-xs hidden md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {u._id !== currentUser?.id && (
                        <>
                          {/* Behavior button */}
                          <button
                            onClick={() => setBehaviorUserId(u._id)}
                            title="ดูพฤติกรรม"
                            className="text-gray-300 hover:text-teal-500 p-1.5 transition-colors rounded-lg hover:bg-teal-50"
                          >
                            <Activity size={15} />
                          </button>
                          {/* Role toggle */}
                          <button
                            onClick={() => roleMutation.mutate({
                              id: u._id,
                              role: u.role === "admin" ? "user" : "admin",
                            })}
                            disabled={roleMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-600 transition-colors"
                          >
                            {u.role === "admin" ? "ลด User" : "เลื่อน Admin"}
                          </button>
                          {/* Suspend toggle */}
                          <button
                            onClick={() => {
                              const msg = u.suspended
                                ? `เปิดใช้งานบัญชี "${u.name}" อีกครั้ง?`
                                : `ระงับบัญชี "${u.name}"? ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้`;
                              if (confirm(msg)) suspendMutation.mutate(u._id);
                            }}
                            disabled={suspendMutation.isPending}
                            title={u.suspended ? "เปิดใช้งาน" : "ระงับบัญชี"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.suspended
                                ? "text-orange-400 hover:text-green-500 hover:bg-green-50"
                                : "text-gray-300 hover:text-orange-500 hover:bg-orange-50"
                            }`}
                          >
                            <Ban size={15} />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (confirm(`ลบผู้ใช้ "${u.name}" ออกจากระบบ?`)) {
                                deleteMutation.mutate(u._id);
                              }
                            }}
                            className="text-gray-300 hover:text-red-500 p-1.5 transition-colors rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                      {u._id === currentUser?.id && (
                        <span className="text-xs text-gray-400">คุณ</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── User Behavior Modal ──────────────────────────────────────────────── */}
      {behaviorUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBehaviorUserId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-teal-500" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    พฤติกรรมผู้ใช้
                  </h2>
                  {behavior?.user && (
                    <p className="text-xs text-gray-400">{behavior.user.name} · {behavior.user.email}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setBehaviorUserId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {loadingBehavior ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Search History */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Search size={15} className="text-blue-500" />
                      ประวัติการค้นหา
                      <span className="text-xs text-gray-400 font-normal">({behavior?.recentSearches.length ?? 0} รายการล่าสุด)</span>
                    </h3>
                    {(behavior?.recentSearches ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">ยังไม่มีประวัติการค้นหา</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {(behavior?.recentSearches ?? []).slice(0, 20).map((s, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-700 truncate">{s.query}</span>
                            <span className="text-xs text-gray-400 shrink-0 ml-2 flex items-center gap-1">
                              <Clock size={10} /> {timeAgo(s.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wishlist / Favorites */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Heart size={15} className="text-red-500" />
                      สินค้าที่บันทึกไว้ (Wishlist)
                      <span className="text-xs text-gray-400 font-normal">({behavior?.wishlist.length ?? 0} รายการ)</span>
                    </h3>
                    {(behavior?.wishlist ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">ยังไม่มีสินค้าในรายการโปรด</p>
                    ) : (
                      <div className="space-y-2">
                        {(behavior?.wishlist ?? []).map((p) => (
                          <div key={p._id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                            <img
                              src={proxyImage(p.image)} alt={p.nameTh}
                              className="w-9 h-9 object-contain rounded-lg bg-white border border-gray-100 p-0.5 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.nameTh}</p>
                              <p className="text-xs text-gray-400">{p.category}</p>
                            </div>
                            <span className="text-sm font-bold text-blue-600 shrink-0">
                              {p.minPrice > 0 ? `฿${p.minPrice.toLocaleString()}` : "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
