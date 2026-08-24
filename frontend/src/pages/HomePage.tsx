import { useState, lazy, Suspense, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock, Search, TrendingUp, Flame, Tag, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../api";
import { Product, COMING_SOON_PLATFORMS } from "../types";
import { proxyImage } from "../utils/imageUrl";
import { ProductCard } from "../components/ui/ProductCard";
import { ProductCardSkeleton } from "../components/ui/ProductCardSkeleton";
import { getRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useDebounce } from "../hooks/useDebounce";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
} from "../hooks/useRecentSearches";

// Lazy-load the 3D globe so Three.js (~600KB) is only downloaded on the homepage
const GlobeHero = lazy(() =>
  import("../components/ui/GlobeHero").then((m) => ({ default: m.GlobeHero }))
);

// Minimal loading placeholder while Three.js downloads
function GlobeHeroSkeleton() {
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ height: "100vh", background: "radial-gradient(ellipse at 50% 60%, #0d1b3e 0%, #050a18 100%)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
        <p className="text-white/30 text-sm tracking-widest uppercase">Loading...</p>
      </div>
    </div>
  );
}

const CATEGORIES = [
  { id: "all",        label: "ทั้งหมด",       emoji: "🛍" },
  { id: "smartphone", label: "สมาร์ทโฟน",    emoji: "📱" },
  { id: "laptop",     label: "โน้ตบุ๊ค",      emoji: "💻" },
  { id: "tablet",     label: "แท็บเล็ต",      emoji: "📟" },
  { id: "audio",      label: "เสียง",          emoji: "🎧" },
  { id: "home",       label: "ของใช้บ้าน",    emoji: "🏠" },
  { id: "fashion",    label: "แฟชั่น",        emoji: "👟" },
  { id: "beauty",     label: "ความงาม",       emoji: "💄" },
  { id: "health",     label: "สุขภาพ",        emoji: "🏥" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");

  // ── Hero search bar state ────────────────────────────────────────────────
  const [heroQ,        setHeroQ]        = useState("");
  const [showHeroSugg, setShowHeroSugg] = useState(false);
  const [heroRecents,  setHeroRecents]  = useState<string[]>([]);
  const debouncedHeroQ = useDebounce(heroQ, 250);
  const heroSearchRef  = useRef<HTMLDivElement>(null);

  // Sync recents when dropdown opens
  useEffect(() => {
    if (showHeroSugg) setHeroRecents(getRecentSearches());
  }, [showHeroSugg]);

  // Close suggestions on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (heroSearchRef.current && !heroSearchRef.current.contains(e.target as Node))
        setShowHeroSugg(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const { data: heroSuggData, isFetching: loadingHeroSugg } = useQuery({
    queryKey: ["suggest-home", debouncedHeroQ],
    queryFn:  () => productsApi.list({ q: debouncedHeroQ }),
    enabled:  debouncedHeroQ.trim().length >= 2,
    staleTime: 30_000,
  });
  const heroSuggestions: Product[] = heroSuggData?.data?.products?.slice(0, 5) ?? [];

  const doHeroSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    setHeroRecents(getRecentSearches());
    setShowHeroSugg(false);
    setHeroQ("");
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleHeroSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    doHeroSearch(heroQ);
  };

  const heroTrending = ["iPhone 17", "Samsung S26", "MacBook Air", "Sony XM6", "AirPods Pro", "Redmi Note 14"];
  const showHeroEmpty   = showHeroSugg && heroQ.trim().length < 2;
  const showHeroResults = showHeroSugg && debouncedHeroQ.trim().length >= 2;

  // Featured products
  const { data: featuredData, isLoading: loadingFeatured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => productsApi.list({ featured: true }),
  });

  // Category browse
  const { data: categoryData, isLoading: loadingCategory } = useQuery({
    queryKey: ["products", activeCategory],
    queryFn: () =>
      productsApi.list(activeCategory !== "all" ? { category: activeCategory } : {}),
  });

  // Recently viewed (read from localStorage, fetch matching products)
  const recentIds = getRecentlyViewed();
  const { data: allProductsData } = useQuery({
    queryKey: ["products", "all-for-recent"],
    queryFn: () => productsApi.list({}),
    enabled: recentIds.length > 0,
    staleTime: 60_000,
  });
  const recentProducts: Product[] = recentIds
    .map((id) =>
      (allProductsData?.data?.products as Product[] | undefined)?.find((p) => p._id === id)
    )
    .filter(Boolean) as Product[];

  const featuredProducts: Product[] = featuredData?.data?.products ?? [];
  const categoryProducts: Product[] = categoryData?.data?.products ?? [];

  // Calculate discount % for a product
  const getTopDiscount = (p: Product) => {
    const active = p.prices.filter(
      (pr) => pr.available !== false && !COMING_SOON_PLATFORMS.includes(pr.platform)
    );
    const best = active.reduce((a, b) => (a.price < b.price ? a : b), active[0]);
    if (!best) return 0;
    return Math.round(((best.originalPrice - best.price) / best.originalPrice) * 100);
  };

  return (
    <div>
      {/* ─── Globe Hero ───────────────────────────────────────────────────────── */}
      <Suspense fallback={<GlobeHeroSkeleton />}>
        <GlobeHero />
      </Suspense>

      {/*
        ── Product sections ──────────────────────────────────────────────────────
        Wrapped in bg-gray-50 because UserLayout removes its own background on
        the homepage (to let the dark globe bg show through behind the navbar).
        This wrapper restores the normal page background for the content below.
      */}
      <div className="bg-gray-50">

      {/* ─── Search Hero (compact) ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-5">

          {/* Live badge */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              อัปเดตราคาทุก 6 ชั่วโมง
            </span>
          </div>

          {/* Search form */}
          <div className="relative" ref={heroSearchRef}>
            <form onSubmit={handleHeroSearch}>
              <div className="flex gap-2 shadow-md shadow-blue-500/8 rounded-2xl">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={heroQ}
                    onChange={(e) => { setHeroQ(e.target.value); setShowHeroSugg(true); }}
                    onFocus={() => setShowHeroSugg(true)}
                    placeholder="ค้นหาสินค้า เช่น iPhone 17, Samsung S26..."
                    className="w-full pl-12 pr-10 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    autoComplete="off"
                  />
                  {heroQ && (
                    <button
                      type="button"
                      onClick={() => { setHeroQ(""); setShowHeroSugg(true); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-6 rounded-2xl transition-all shrink-0 text-sm"
                >
                  ค้นหา
                </button>
              </div>
            </form>

            {/* ── Dropdown: Recent + Trending (empty state) ──────────── */}
            {showHeroEmpty && (heroRecents.length > 0 || heroTrending.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 text-left">
                {heroRecents.length > 0 && (
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={10} /> ค้นหาล่าสุด
                      </span>
                      <button
                        onClick={(e) => { e.preventDefault(); clearRecentSearches(); setHeroRecents([]); }}
                        className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                      >
                        ล้างทั้งหมด
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {heroRecents.map((r) => (
                        <div
                          key={r}
                          onClick={() => doHeroSearch(r)}
                          className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
                        >
                          <Clock size={13} className="text-gray-300 shrink-0" />
                          <span className="text-sm text-gray-700 flex-1">{r}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              removeRecentSearch(r); setHeroRecents(getRecentSearches());
                            }}
                            className="text-gray-200 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {heroRecents.length > 0 && <div className="border-t border-gray-50 mx-4" />}
                <div className="px-4 pt-2.5 pb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <TrendingUp size={10} /> กำลังฮิต
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {heroTrending.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => doHeroSearch(kw)}
                        className="text-xs px-2.5 py-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg text-gray-600 transition-all font-medium"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Dropdown: Live Product Suggestions ─────────────────── */}
            {showHeroResults && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 text-left">
                {loadingHeroSugg ? (
                  <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    กำลังค้นหา...
                  </div>
                ) : heroSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">ไม่พบสินค้าที่ตรงกัน</div>
                ) : (
                  <>
                    <div className="px-4 pt-2 pb-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Search size={10} /> ผลการค้นหา
                      </p>
                    </div>
                    {heroSuggestions.map((p) => {
                      const active = p.prices.filter(
                        (pr) => pr.available !== false && !COMING_SOON_PLATFORMS.includes(pr.platform)
                      );
                      const minPrice = active.length > 0
                        ? Math.min(...active.map((pr) => pr.price))
                        : p.minPrice;
                      return (
                        <Link
                          key={p._id}
                          to={`/product/${p._id}`}
                          onClick={() => { addRecentSearch(heroQ.trim()); setShowHeroSugg(false); }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <img
                            src={proxyImage(p.image)}
                            alt={p.nameTh}
                            className="w-9 h-9 object-contain rounded-lg shrink-0 bg-gray-50"
                            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.nameTh}</p>
                            <p className="text-xs text-gray-400">{p.brand}</p>
                          </div>
                          <p className="text-sm font-bold text-blue-600 shrink-0">฿{minPrice.toLocaleString()}</p>
                        </Link>
                      );
                    })}
                    <button
                      onClick={() => doHeroSearch(heroQ)}
                      className="w-full px-4 py-2.5 text-sm text-blue-600 font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 border-t border-gray-50"
                    >
                      ดูผลการค้นหาทั้งหมด <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Trending keywords */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
              <TrendingUp size={11} /> กำลังฮิต:
            </span>
            {[
              { label: "iPhone 17",     q: "iPhone 17"    },
              { label: "Samsung S26",   q: "Samsung S26"  },
              { label: "MacBook Air",   q: "MacBook Air"  },
              { label: "Sony XM6",      q: "Sony XM6"     },
              { label: "AirPods Pro",   q: "AirPods Pro"  },
              { label: "Xiaomi 14T",    q: "Xiaomi 14T"   },
            ].map((kw) => (
              <button
                key={kw.q}
                onClick={() => navigate(`/search?q=${encodeURIComponent(kw.q)}`)}
                className="text-xs px-2.5 py-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg text-gray-600 transition-all font-medium animate-fade-slide"
              >
                {kw.label}
              </button>
            ))}
          </div>

          {/* Category quick links */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {CATEGORIES.slice(1).map((cat) => (
              <Link
                key={cat.id}
                to={`/search?category=${cat.id}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 text-gray-600 text-xs font-medium rounded-lg transition-all"
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="border-t border-gray-50 bg-gray-50/60">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Flame size={11} className="text-orange-400" />
              <span className="font-semibold text-gray-700">48</span> สินค้า
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="flex items-center gap-1.5">
              <Tag size={11} className="text-blue-400" />
              <span className="font-semibold text-gray-700">10+</span> แพลตฟอร์ม
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live ราคาทุก 6 ชม.
            </span>
          </div>
        </div>
      </div>

      {/* ─── Featured ─────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">🔥 สินค้าแนะนำ</h2>
          <Link
            to="/search"
            className="text-sm text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
          >
            ดูทั้งหมด <ChevronRight size={15} />
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.slice(0, 4).map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Hot Deals ────────────────────────────────────────────────────────── */}
      {!loadingFeatured && featuredProducts.length === 0 ? null : (
        (() => {
          const allForDeals = [...featuredProducts, ...categoryProducts]
            .filter((p, i, arr) => arr.findIndex((x) => x._id === p._id) === i)
            .filter((p) => getTopDiscount(p) >= 10)
            .sort((a, b) => getTopDiscount(b) - getTopDiscount(a))
            .slice(0, 4);
          if (allForDeals.length === 0) return null;
          return (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">🏷 ลดราคาสูงสุด</h2>
                <Link to="/search" className="text-sm text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                  ดูทั้งหมด <ChevronRight size={15} />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {allForDeals.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
            </section>
          );
        })()
      )}

      {/* ─── Browse by category ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-xl font-bold text-gray-900 mb-5">🛍 เลือกดูตามหมวดหมู่</h2>

        {/* Category tabs — horizontal scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {loadingCategory ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : categoryProducts.length === 0 ? (
          <div className="text-center py-16 card border-dashed">
            <p className="text-5xl mb-4">
              {CATEGORIES.find(c => c.id === activeCategory)?.emoji ?? "🔍"}
            </p>
            <p className="text-lg font-semibold text-gray-700">ยังไม่มีสินค้าในหมวดหมู่นี้</p>
            <p className="text-sm text-gray-400 mt-1">ลอง Seed ข้อมูลจาก Admin Panel หรือรอเพิ่มเร็วๆ นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categoryProducts.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Recently Viewed ──────────────────────────────────────────────────── */}
      {recentProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-gray-400" /> เพิ่งดูไป
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recentProducts.slice(0, 5).map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      </div>{/* end bg-gray-50 wrapper */}
    </div>
  );
}
