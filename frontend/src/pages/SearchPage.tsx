import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../api";
import { Product, COMING_SOON_PLATFORMS } from "../types";
import { ProductCard } from "../components/ui/ProductCard";
import { ProductCardSkeleton } from "../components/ui/ProductCardSkeleton";
import { PlatformLogo } from "../components/ui/PlatformLogo";
import { useDebounce } from "../hooks/useDebounce";
import {
  Search, SlidersHorizontal, X, Star, Truck,
  PackageSearch, Frown, ShieldCheck, Package, ChevronDown,
  RotateCcw,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "",           label: "ทุกหมวด",     emoji: "🛍" },
  { id: "smartphone", label: "สมาร์ทโฟน",   emoji: "📱" },
  { id: "laptop",     label: "โน้ตบุ๊ค",    emoji: "💻" },
  { id: "tablet",     label: "แท็บเล็ต",    emoji: "📟" },
  { id: "audio",      label: "เสียง",        emoji: "🎧" },
  { id: "home",       label: "ของใช้ในบ้าน", emoji: "🏠" },
  { id: "fashion",    label: "แฟชั่น",       emoji: "👟" },
  { id: "beauty",     label: "ความงาม",      emoji: "💄" },
  { id: "health",     label: "สุขภาพ",       emoji: "💊" },
];

const PRICE_PRESETS = [
  { label: "ทั้งหมด",       min: 0,    max: Infinity },
  { label: "< ฿500",        min: 0,    max: 500      },
  { label: "฿500–1K",       min: 500,  max: 1000     },
  { label: "฿1K–5K",        min: 1000, max: 5000     },
  { label: "฿5K–20K",       min: 5000, max: 20000    },
  { label: "฿20K+",         min: 20000,max: Infinity },
];

const RATING_OPTIONS = [
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4.0 },
  { label: "4.5+", value: 4.5 },
];

const DISCOUNT_OPTIONS = [
  { label: "10%+", value: 10 },
  { label: "20%+", value: 20 },
  { label: "30%+", value: 30 },
];

const OFFICIAL_STORES = new Set([
  "Apple Store", "Samsung Shop", "Sony Store",
  "Dyson Store", "Nike.com", "Studio 7",
]);

type SortKey = "default" | "price_asc" | "price_desc" | "discount" | "rating";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default",    label: "แนะนำ"           },
  { value: "price_asc",  label: "ราคา: น้อย → มาก" },
  { value: "price_desc", label: "ราคา: มาก → น้อย" },
  { value: "discount",   label: "ส่วนลดสูงสุด"      },
  { value: "rating",     label: "คะแนนสูงสุด"       },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActive(p: Product) {
  return p.prices.filter(
    (pr) => pr.available !== false && !COMING_SOON_PLATFORMS.includes(pr.platform)
  );
}
function getMinPrice(p: Product) {
  const a = getActive(p);
  return a.length ? Math.min(...a.map((pr) => pr.price)) : p.minPrice;
}
function getBest(p: Product) {
  const a = getActive(p);
  if (!a.length) return null;
  return a.reduce((x, y) => (x.price < y.price ? x : y));
}
function getDiscount(p: Product) {
  const best = getBest(p);
  if (!best) return 0;
  return Math.round(((best.originalPrice - best.price) / best.originalPrice) * 100);
}

// ─── Filter state interface ───────────────────────────────────────────────────

interface Filters {
  minPrice:          number;
  maxPrice:          number;
  platforms:         Set<string>;
  minRating:         number;
  minDiscount:       number;
  onlyFreeShipping:  boolean;
  onlyOfficialStore: boolean;
  onlyInStock:       boolean;
}

const DEFAULT_FILTERS: Filters = {
  minPrice:          0,
  maxPrice:          Infinity,
  platforms:         new Set(),
  minRating:         0,
  minDiscount:       0,
  onlyFreeShipping:  false,
  onlyOfficialStore: false,
  onlyInStock:       false,
};

// ─── Filter sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  filters, setFilters, availablePlatforms, filteredCount, totalCount, onReset,
}: {
  filters:            Filters;
  setFilters:         React.Dispatch<React.SetStateAction<Filters>>;
  availablePlatforms: string[];
  filteredCount:      number;
  totalCount:         number;
  onReset:            () => void;
}) {
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [platformsExpanded, setPlatformsExpanded] = useState(true);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const togglePlatform = (p: string) => {
    const next = new Set(filters.platforms);
    next.has(p) ? next.delete(p) : next.add(p);
    set("platforms", next);
  };

  const applyCustomPrice = () => {
    set("minPrice", minInput ? Number(minInput) : 0);
    set("maxPrice", maxInput ? Number(maxInput) : Infinity);
  };

  const activeCount = [
    filters.minPrice > 0 || filters.maxPrice < Infinity,
    filters.platforms.size > 0,
    filters.minRating > 0,
    filters.minDiscount > 0,
    filters.onlyFreeShipping,
    filters.onlyOfficialStore,
    filters.onlyInStock,
  ].filter(Boolean).length;

  return (
    <div className="card divide-y divide-gray-100 text-sm sticky top-20">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-blue-500" />
          <span className="font-bold text-gray-800">ตัวกรอง</span>
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <RotateCcw size={11} /> ล้าง
          </button>
        )}
      </div>

      {/* ── Price range ──────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">💰 ช่วงราคา</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_PRESETS.map((preset) => {
            const active =
              filters.minPrice === preset.min &&
              (preset.max === Infinity ? filters.maxPrice === Infinity : filters.maxPrice === preset.max);
            return (
              <button
                key={preset.label}
                onClick={() => {
                  set("minPrice", preset.min);
                  set("maxPrice", preset.max);
                  setMinInput(preset.min > 0 ? String(preset.min) : "");
                  setMaxInput(preset.max < Infinity ? String(preset.max) : "");
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number" placeholder="ต่ำสุด" value={minInput} min={0}
            onChange={(e) => setMinInput(e.target.value)}
            className="input text-xs py-1.5 px-2 flex-1 min-w-0"
          />
          <span className="text-gray-300 text-xs shrink-0">–</span>
          <input
            type="number" placeholder="สูงสุด" value={maxInput} min={0}
            onChange={(e) => setMaxInput(e.target.value)}
            className="input text-xs py-1.5 px-2 flex-1 min-w-0"
          />
          <button onClick={applyCustomPrice} className="btn-primary text-xs px-2.5 py-1.5 shrink-0">
            ตกลง
          </button>
        </div>
      </div>

      {/* ── Platforms ────────────────────────────────────────────────────── */}
      {availablePlatforms.length > 0 && (
        <div className="px-4 py-4 space-y-2">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setPlatformsExpanded((v) => !v)}
          >
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">🏪 แพลตฟอร์ม</p>
            <ChevronDown
              size={13}
              className={`text-gray-400 transition-transform ${platformsExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {platformsExpanded && (
            <div className="space-y-1.5 pt-1">
              {availablePlatforms.map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2.5 cursor-pointer group py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={filters.platforms.has(platform)}
                    onChange={() => togglePlatform(platform)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <PlatformLogo platform={platform} size={16} />
                  <span className="text-gray-700 group-hover:text-blue-600 transition-colors text-xs flex-1">
                    {platform}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rating ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-2.5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">⭐ คะแนนรีวิว</p>
        <div className="flex gap-1.5">
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("minRating", filters.minRating === opt.value ? 0 : opt.value)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filters.minRating === opt.value
                  ? "bg-amber-400 text-white border-amber-400"
                  : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
              }`}
            >
              <Star size={10} className={filters.minRating === opt.value ? "fill-white" : "fill-amber-400 text-amber-400"} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Discount ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-2.5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📉 ส่วนลด</p>
        <div className="flex gap-1.5">
          {DISCOUNT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("minDiscount", filters.minDiscount === opt.value ? 0 : opt.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filters.minDiscount === opt.value
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-red-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toggle options ────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">เงื่อนไขอื่น</p>

        {[
          {
            key:   "onlyFreeShipping"  as const,
            icon:  <Truck size={13} className="text-emerald-500" />,
            label: "ส่งฟรี",
          },
          {
            key:   "onlyOfficialStore" as const,
            icon:  <ShieldCheck size={13} className="text-blue-500" />,
            label: "Official Store",
          },
          {
            key:   "onlyInStock"       as const,
            icon:  <Package size={13} className="text-violet-500" />,
            label: "พร้อมส่ง / มีสินค้า",
          },
        ].map(({ key, icon, label }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer group">
            <span className="flex items-center gap-2 text-gray-700 group-hover:text-gray-900 text-xs">
              {icon} {label}
            </span>
            <button
              onClick={() => set(key, !filters[key])}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                filters[key] ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  filters[key] ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        ))}
      </div>

      {/* ── Footer: result count ─────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-gray-50 rounded-b-2xl">
        <p className="text-xs text-center text-gray-500">
          แสดง{" "}
          <span className="font-bold text-blue-600">{filteredCount}</span>
          {" "}จาก{" "}
          <span className="font-semibold">{totalCount}</span>
          {" "}รายการ
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ        = searchParams.get("q")        || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSort     = searchParams.get("sort")     || "default";
  const urlFeatured = searchParams.get("featured") === "true";

  // Validate urlSort against known options
  const initSort: SortKey = SORT_OPTIONS.some((o) => o.value === urlSort)
    ? (urlSort as SortKey)
    : "default";

  const [localQ,      setLocalQ]      = useState(urlQ);
  const [sort,        setSort]        = useState<SortKey>(initSort);
  const [filters,     setFilters]     = useState<Filters>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const debouncedQ = useDebounce(localQ, 300);

  // Sync localQ when URL changes (e.g. navbar search)
  useEffect(() => { setLocalQ(urlQ); }, [urlQ]);

  // Re-apply sort from URL when navigating to this page fresh
  useEffect(() => {
    const s = searchParams.get("sort") || "default";
    const valid = SORT_OPTIONS.some((o) => o.value === s) ? (s as SortKey) : "default";
    setSort(valid);
  }, [searchParams.get("sort")]); // eslint-disable-line

  // Sync typed query to URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    if (debouncedQ) p.set("q", debouncedQ);
    else            p.delete("q");
    setSearchParams(p, { replace: true });
  }, [debouncedQ]); // eslint-disable-line

  // Sync sort selection to URL
  const handleSortChange = (newSort: SortKey) => {
    setSort(newSort);
    const p = new URLSearchParams(searchParams);
    if (newSort !== "default") p.set("sort", newSort);
    else                       p.delete("sort");
    setSearchParams(p, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["search", debouncedQ, urlCategory],
    queryFn:  () =>
      productsApi.list({ q: debouncedQ || undefined, category: urlCategory || undefined }),
    staleTime: 30_000,
  });

  const rawProducts: Product[] = data?.data?.products ?? [];
  const total: number          = data?.data?.total    ?? 0;

  // Unique platforms from results
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    rawProducts.forEach((p) =>
      getActive(p).forEach((pr) => set.add(pr.platform))
    );
    return [...set].sort();
  }, [rawProducts]);

  // Apply all filters
  const products = useMemo(() => {
    return [...rawProducts]
      .filter((p) => {
        const best     = getBest(p);
        const minP     = getMinPrice(p);
        const discount = getDiscount(p);

        if (urlFeatured && !p.featured) return false;
        if (minP < filters.minPrice || minP > filters.maxPrice) return false;

        if (filters.platforms.size > 0) {
          const productPlatforms = new Set(getActive(p).map((pr) => pr.platform));
          if (![...filters.platforms].some((pl) => productPlatforms.has(pl))) return false;
        }

        if (filters.minRating > 0 && (!best || best.rating < filters.minRating)) return false;
        if (filters.minDiscount > 0 && discount < filters.minDiscount)            return false;
        if (filters.onlyFreeShipping  && (!best || best.shipping !== 0))          return false;
        if (filters.onlyOfficialStore && (!best || !OFFICIAL_STORES.has(best.platform))) return false;
        if (filters.onlyInStock       && (!best || !best.inStock))                return false;

        return true;
      })
      .sort((a, b) => {
        if (sort === "price_asc")  return getMinPrice(a) - getMinPrice(b);
        if (sort === "price_desc") return getMinPrice(b) - getMinPrice(a);
        if (sort === "discount")   return getDiscount(b) - getDiscount(a);
        if (sort === "rating") {
          const ra = getBest(a)?.rating ?? 0;
          const rb = getBest(b)?.rating ?? 0;
          return rb - ra;
        }
        return 0;
      });
  }, [rawProducts, filters, sort, urlFeatured]);

  const setCategory = (cat: string) => {
    const p = new URLSearchParams(searchParams);
    if (cat) p.set("category", cat);
    else     p.delete("category");
    setSearchParams(p);
  };

  const clearSearch = () => {
    setLocalQ("");
    const p = new URLSearchParams(searchParams);
    p.delete("q");
    setSearchParams(p);
  };

  const resetAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSort("default");
    setLocalQ("");
    // Clear all URL params atomically in one call (avoids race between separate setSearchParams calls)
    setSearchParams(new URLSearchParams());
  };

  const activeFilterCount = [
    filters.minPrice > 0 || filters.maxPrice < Infinity,
    filters.platforms.size > 0,
    filters.minRating > 0,
    filters.minDiscount > 0,
    filters.onlyFreeShipping,
    filters.onlyOfficialStore,
    filters.onlyInStock,
    sort !== "default",
    urlFeatured,
  ].filter(Boolean).length;

  // Active filter chips for display
  const filterChips: { label: string; clear: () => void }[] = [];
  if (filters.minPrice > 0 || filters.maxPrice < Infinity) {
    const lo = filters.minPrice > 0 ? `฿${filters.minPrice.toLocaleString()}` : "฿0";
    const hi = filters.maxPrice < Infinity ? `฿${filters.maxPrice.toLocaleString()}` : "∞";
    filterChips.push({ label: `${lo}–${hi}`, clear: () => setFilters((f) => ({ ...f, minPrice: 0, maxPrice: Infinity })) });
  }
  if (filters.platforms.size > 0)
    filterChips.push({ label: `${filters.platforms.size} แพลตฟอร์ม`, clear: () => setFilters((f) => ({ ...f, platforms: new Set() })) });
  if (filters.minRating > 0)
    filterChips.push({ label: `⭐ ${filters.minRating}+`, clear: () => setFilters((f) => ({ ...f, minRating: 0 })) });
  if (filters.minDiscount > 0)
    filterChips.push({ label: `ลด ${filters.minDiscount}%+`, clear: () => setFilters((f) => ({ ...f, minDiscount: 0 })) });
  if (filters.onlyFreeShipping)
    filterChips.push({ label: "ส่งฟรี", clear: () => setFilters((f) => ({ ...f, onlyFreeShipping: false })) });
  if (filters.onlyOfficialStore)
    filterChips.push({ label: "💎 Official Store", clear: () => setFilters((f) => ({ ...f, onlyOfficialStore: false })) });
  if (filters.onlyInStock)
    filterChips.push({ label: "พร้อมส่ง", clear: () => setFilters((f) => ({ ...f, onlyInStock: false })) });
  if (sort !== "default") {
    const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort;
    filterChips.push({
      label: `เรียง: ${sortLabel}`,
      clear: () => handleSortChange("default"),
    });
  }
  if (urlFeatured) {
    filterChips.push({
      label: "⭐ แนะนำ",
      clear: () => {
        const p = new URLSearchParams(searchParams);
        p.delete("featured");
        setSearchParams(p);
      },
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Top bar: search + sort ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="input pl-10 pr-9 w-full"
          />
          {localQ && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`lg:hidden flex items-center gap-1.5 input px-3 text-sm font-medium transition-colors ${
              sidebarOpen || activeFilterCount > 0 ? "border-blue-400 text-blue-600 bg-blue-50" : "text-gray-500"
            }`}
          >
            <SlidersHorizontal size={14} />
            ตัวกรอง
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as SortKey)}
            className="input appearance-none cursor-pointer text-sm min-w-[160px]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Category pills ────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              urlCategory === cat.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* ── Active filter chips ───────────────────────────────────────────── */}
      {filterChips.length > 0 && !isLoading && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filterChips.map((chip) => (
            <button
              key={chip.label}
              onClick={chip.clear}
              className="flex items-center gap-1.5 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium hover:bg-blue-200 transition-colors"
            >
              {chip.label} <X size={10} />
            </button>
          ))}
          <button
            onClick={resetAllFilters}
            className="text-xs text-gray-400 hover:text-red-500 px-2.5 py-1 rounded-full border border-gray-200 hover:border-red-200 transition-colors flex items-center gap-1"
          >
            <RotateCcw size={10} /> ล้างทั้งหมด
          </button>
        </div>
      )}

      {/* ── Main layout: sidebar + grid ───────────────────────────────────── */}
      <div className="flex gap-6">

        {/* Sidebar — always visible on lg+, toggleable on mobile */}
        <aside className={`shrink-0 w-56 ${sidebarOpen ? "block" : "hidden"} lg:block`}>
          <FilterSidebar
            filters={filters}
            setFilters={setFilters}
            availablePlatforms={availablePlatforms}
            filteredCount={products.length}
            totalCount={total}
            onReset={resetAllFilters}
          />
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {/* Result count */}
          {!isLoading && (
            <p className="text-sm text-gray-400 mb-4">
              {debouncedQ
                ? <>ผล <span className="font-semibold text-gray-700">"{debouncedQ}"</span>{" "}
                    — <span className="font-semibold text-gray-900">{products.length}</span> รายการ
                    {activeFilterCount > 0 && ` (กรองจาก ${total})`}
                  </>
                : activeFilterCount > 0
                  ? <><span className="font-semibold text-gray-900">{products.length}</span> จาก {total} รายการ</>
                  : <>สินค้าทั้งหมด <span className="font-semibold text-gray-900">{total}</span> รายการ</>
              }
            </p>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              query={debouncedQ}
              hasFilters={activeFilterCount > 0}
              onReset={resetAllFilters}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  query, hasFilters, onReset,
}: {
  query: string; hasFilters: boolean; onReset: () => void;
}) {
  return (
    <div className="card py-20 px-8 text-center flex flex-col items-center">
      <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-5">
        {query ? <Frown size={36} className="text-gray-300" /> : <PackageSearch size={36} className="text-gray-300" />}
      </div>

      <h2 className="text-lg font-bold text-gray-700 mb-1">
        {query ? `ไม่พบ "${query}"` : hasFilters ? "ไม่มีสินค้าที่ตรงเงื่อนไข" : "ไม่พบสินค้า"}
      </h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        {query
          ? "ลองใช้คำค้นหาอื่น หรือตรวจสอบการสะกด"
          : hasFilters
          ? "ลองผ่อนเงื่อนไขตัวกรอง หรือล้างตัวกรองทั้งหมด"
          : "ลองเปลี่ยนหมวดหมู่"}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-blue-600 font-semibold border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition-colors"
        >
          <RotateCcw size={13} /> ล้างตัวกรอง
        </button>
        <Link
          to="/"
          className="text-sm text-gray-500 font-medium border border-gray-200 rounded-xl px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          กลับหน้าหลัก
        </Link>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 w-full max-w-sm">
        <p className="text-xs text-gray-400 mb-3 font-medium">ลองค้นหาสิ่งเหล่านี้</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {["iPhone", "Samsung", "Sony", "MacBook", "Dyson"].map((s) => (
            <Link
              key={s}
              to={`/search?q=${s}`}
              className="text-xs bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-xl transition-colors font-medium"
            >
              {s}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
