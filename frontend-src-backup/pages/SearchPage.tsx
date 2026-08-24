import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../api";
import { Product } from "../types";
import { ProductCard } from "../components/ui/ProductCard";
import { Search } from "lucide-react";

const CATEGORIES = [
  { id: "", label: "ทุกหมวดหมู่" },
  { id: "smartphone", label: "สมาร์ทโฟน" },
  { id: "laptop", label: "โน้ตบุ๊ค" },
  { id: "tablet", label: "แท็บเล็ต" },
  { id: "audio", label: "เสียง" },
  { id: "home", label: "ของใช้ในบ้าน" },
  { id: "fashion", label: "แฟชั่น" },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["search", q, category],
    queryFn: () => productsApi.list({ q: q || undefined, category: category || undefined }),
  });

  const products: Product[] = data?.data?.products ?? [];
  const total: number = data?.data?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Search size={20} className="text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {q ? `ผลการค้นหา "${q}"` : "สินค้าทั้งหมด"}
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">พบ {total} รายการ</p>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="w-44 shrink-0 hidden md:block">
          <div className="card p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">หมวดหมู่</p>
            <div className="space-y-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    if (c.id) p.set("category", c.id);
                    else p.delete("category");
                    setSearchParams(p);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    category === c.id
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="bg-gray-100 rounded-xl aspect-square mb-3" />
                  <div className="h-3 bg-gray-100 rounded mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 card">
              <Search size={40} className="text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">ไม่พบสินค้าที่ค้นหา</p>
              <p className="text-sm text-gray-400 mt-1">ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
