import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, TrendingDown, ShieldCheck, Zap, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../api";
import { Product } from "../types";
import { ProductCard } from "../components/ui/ProductCard";

const CATEGORIES = [
  { id: "all", label: "ทั้งหมด" },
  { id: "smartphone", label: "📱 สมาร์ทโฟน" },
  { id: "laptop", label: "💻 โน้ตบุ๊ค" },
  { id: "tablet", label: "📟 แท็บเล็ต" },
  { id: "audio", label: "🎧 เสียง" },
  { id: "home", label: "🏠 บ้าน" },
  { id: "fashion", label: "👟 แฟชั่น" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: featuredData, isLoading: loadingFeatured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => productsApi.list({ featured: true }),
  });

  const { data: categoryData, isLoading: loadingCategory } = useQuery({
    queryKey: ["products", activeCategory],
    queryFn: () =>
      productsApi.list(activeCategory !== "all" ? { category: activeCategory } : {}),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
  };

  const featuredProducts: Product[] = featuredData?.data?.products ?? [];
  const categoryProducts: Product[] = categoryData?.data?.products ?? [];

  return (
    <div>
      {/* ─── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-blue-400/30">
            <Zap size={14} className="text-yellow-300" />
            เปรียบราคาจากหลายร้านค้าชั้นนำในไทย
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
            เปรียบราคาสินค้า<br />
            <span className="text-blue-200">ประหยัดได้จริง</span>
          </h1>
          <p className="text-blue-100 text-lg max-w-xl mx-auto mb-10">
            เช็คราคาจาก Shopee, Lazada, JD Central และอีกหลายร้าน ในที่เดียว
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหาสินค้า เช่น iPhone 15, Samsung Galaxy..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-900 text-base focus:outline-none focus:ring-4 focus:ring-white/30 shadow-xl"
              />
            </div>
            <button type="submit"
              className="bg-white text-blue-700 font-bold px-7 py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-xl shrink-0">
              ค้นหา
            </button>
          </form>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-10 text-sm text-blue-100">
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-green-300" /> ข้อมูลจริงจากหลายแพลตฟอร์ม</span>
            <span className="flex items-center gap-1.5"><TrendingDown size={15} className="text-yellow-300" /> อัพเดทราคาสม่ำเสมอ</span>
          </div>
        </div>
      </section>

      {/* ─── Featured ─────────────────────────────────────────────────────────── */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">🔥 สินค้าแนะนำ</h2>
            <button onClick={() => navigate("/search")}
              className="text-sm text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              ดูทั้งหมด <ChevronRight size={15} />
            </button>
          </div>
          {loadingFeatured ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="bg-gray-100 rounded-xl aspect-square mb-3" />
                  <div className="h-3 bg-gray-100 rounded mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featuredProducts.slice(0, 4).map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Browse by category ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-xl font-bold text-gray-900 mb-5">🛍 เลือกดูตามหมวดหมู่</h2>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {loadingCategory ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="bg-gray-100 rounded-xl aspect-square mb-3" />
                <div className="h-3 bg-gray-100 rounded mb-2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : categoryProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">ยังไม่มีสินค้าในหมวดหมู่นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categoryProducts.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
