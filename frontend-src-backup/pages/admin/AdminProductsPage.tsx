import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { Trash2, Plus, TrendingDown, RefreshCw } from "lucide-react";
import { Product } from "../../types";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => adminApi.getProducts(),
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const products: Product[] = data?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สินค้า</h1>
          <p className="text-gray-500 text-sm">จัดการสินค้าทั้งหมด ({products.length} รายการ)</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={16} /> เพิ่มสินค้า
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            กำลังโหลด...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p>ยังไม่มีสินค้า — ลอง Seed ข้อมูลตัวอย่างจากหน้าภาพรวม</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">สินค้า</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">หมวดหมู่</th>
                <th className="text-center px-4 py-3 font-medium">ร้านค้า</th>
                <th className="text-right px-4 py-3 font-medium">ราคาต่ำสุด</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.nameTh}
                        className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 p-0.5 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/100?text=?"; }}
                      />
                      <div>
                        <p className="font-semibold text-gray-900 line-clamp-1">{p.nameTh}</p>
                        <p className="text-gray-400 text-xs">{p.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="badge bg-gray-100 text-gray-600">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1 text-gray-600">
                      <TrendingDown size={13} className="text-blue-400" />
                      {p.prices.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">
                    ฿{p.minPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`ลบสินค้า "${p.nameTh}" ?`)) deleteMutation.mutate(p._id);
                      }}
                      className="text-gray-300 hover:text-red-500 p-1.5 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
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
