import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { Trash2, Shield, User, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.getUsers(),
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.setRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const users: AdminUser[] = data?.data ?? [];

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
          <div className="p-8 text-center text-gray-400">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            กำลังโหลด...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">ชื่อ / อีเมล</th>
                <th className="text-center px-4 py-3 font-medium">Role</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">สมัครเมื่อ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
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
                      {u.role === "admin" ? <><Shield size={10} className="inline mr-1" />Admin</> : <><User size={10} className="inline mr-1" />User</>}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-400 text-xs hidden md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {u._id !== currentUser?.id && (
                        <>
                          <button
                            onClick={() => roleMutation.mutate({
                              id: u._id,
                              role: u.role === "admin" ? "user" : "admin",
                            })}
                            disabled={roleMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-600 transition-colors"
                          >
                            {u.role === "admin" ? "เปลี่ยนเป็น User" : "เลื่อนเป็น Admin"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`ลบผู้ใช้ "${u.name}" ออกจากระบบ?`)) {
                                deleteMutation.mutate(u._id);
                              }
                            }}
                            className="text-gray-300 hover:text-red-500 p-1.5 transition-colors"
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
    </div>
  );
}
