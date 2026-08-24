import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { Bell, CheckCircle, Clock } from "lucide-react";

interface Alert {
  _id: string;
  user: { name: string; email: string };
  product: { nameTh: string; image: string };
  targetPrice: number;
  triggered: boolean;
  createdAt: string;
}

export default function AdminLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => adminApi.stats(), // placeholder — for now show stats
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">บันทึก</h1>
        <p className="text-gray-500 text-sm">ประวัติการใช้งานระบบ</p>
      </div>

      <div className="card p-8 text-center text-gray-400">
        <Bell size={36} className="mx-auto mb-3 text-gray-200" />
        <p className="font-medium text-gray-500">System Logs</p>
        <p className="text-sm mt-1">ฟีเจอร์นี้จะแสดงประวัติการ login, การแจ้งเตือนราคา และกิจกรรมต่างๆ</p>
        <p className="text-xs mt-4 text-gray-300">Coming soon</p>
      </div>
    </div>
  );
}
