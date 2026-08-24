import { useState, useRef } from "react";
import { liveSearchApi } from "../api";
import { PLATFORM_COLORS } from "../types";
import { PlatformLogo } from "../components/ui/PlatformLogo";
import { proxyImage } from "../utils/imageUrl";
import {
  Search, ExternalLink, Star, Tag, Telescope, AlertCircle,
  Loader2, ShoppingBag, CheckCircle2, XCircle, Sparkles,
  Clock, Crown, ChevronDown, ChevronUp, Package,
} from "lucide-react";

// ─── Platform registry ─────────────────────────────────────────────────────────

interface Platform { id: string; label: string }

const PLATFORMS: Platform[] = [
  { id: "lazada",   label: "Lazada"         },
  { id: "bnn",      label: "Banana IT"      },
  { id: "powerbuy", label: "Power Buy"      },
  { id: "jib",      label: "JIB"            },
  { id: "central",  label: "Central Online" },
  { id: "samsung",  label: "Samsung Shop"   },
  { id: "sony",     label: "Sony Store"     },
  { id: "apple",    label: "Apple Store"    },
  { id: "studio7",  label: "Studio 7"       },
  { id: "dyson",    label: "Dyson Store"    },
  { id: "nike",     label: "Nike.com"       },
  { id: "watsons",  label: "Watsons"        },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ScrapedCoupon {
  description: string; discount: number; discountPct: number;
  minSpend: number; afterPrice: number;
}
interface LiveResult {
  name: string; price: number; url: string; inStock: boolean;
  rating: number; reviews: number; image?: string; coupon?: ScrapedCoupon;
}
type PlatformStatus = "idle" | "loading" | "done" | "error";
interface PlatformResult {
  label: string; status: PlatformStatus;
  items: LiveResult[]; count: number; error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function effectivePrice(item: LiveResult) {
  return item.coupon?.afterPrice && item.coupon.afterPrice < item.price
    ? item.coupon.afterPrice : item.price;
}

// ─── CompareRow ────────────────────────────────────────────────────────────────

function CompareRow({
  result, isCheapest,
}: {
  platformId?: string;
  result: PlatformResult;
  isCheapest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hex    = PLATFORM_COLORS[result.label] ?? "#6b7280";
  const best   = result.items[0];
  const others = result.items.slice(1);

  return (
    <div>
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${
        isCheapest ? "bg-green-50/60" : "hover:bg-gray-50/70"
      }`}>

        {/* Platform */}
        <div className="flex items-center gap-2.5 w-36 shrink-0">
          <PlatformLogo platform={result.label} size={28} />
          <div>
            <p className="text-sm font-bold text-gray-800 leading-none">{result.label}</p>
            {isCheapest && result.status === "done" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 mt-0.5">
                <Crown size={9} className="fill-green-500 text-green-500" /> ถูกสุด
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {result.status === "loading" && (
          <div className="flex items-center gap-3 flex-1 animate-pulse">
            <div className="w-12 h-12 bg-gray-100 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="w-24 h-6 bg-gray-100 rounded-lg" />
          </div>
        )}

        {/* Error */}
        {result.status === "error" && (
          <div className="flex items-center gap-2 flex-1 text-sm text-red-400">
            <AlertCircle size={14} />
            <span>{result.error ?? "ค้นหาไม่สำเร็จ"}</span>
          </div>
        )}

        {/* No results */}
        {result.status === "done" && result.count === 0 && (
          <div className="flex items-center gap-2 flex-1 text-sm text-gray-400">
            <Package size={14} />
            <span>ไม่พบสินค้าที่ตรงกัน</span>
          </div>
        )}

        {/* Best result */}
        {result.status === "done" && best && (() => {
          const price = effectivePrice(best);
          return (
            <>
              {/* Thumbnail */}
              <ProductThumb item={best} />

              {/* Name */}
              <p className="flex-1 text-sm text-gray-700 line-clamp-2 min-w-0">{best.name}</p>

              {/* Coupon */}
              {best.coupon && best.coupon.afterPrice < best.price && (
                <div className="hidden md:flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-0.5 shrink-0">
                  <Tag size={9} className="text-green-600" />
                  <span className="text-[10px] font-bold text-green-700 whitespace-nowrap">
                    {best.coupon.description || `ลด ฿${(best.price - best.coupon.afterPrice).toLocaleString()}`}
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="text-right shrink-0 w-28">
                <p className={`text-xl font-extrabold ${isCheapest ? "text-green-600" : "text-blue-600"}`}>
                  ฿{price.toLocaleString()}
                </p>
                {best.coupon && best.coupon.afterPrice < best.price && (
                  <p className="text-xs text-gray-400 line-through">฿{best.price.toLocaleString()}</p>
                )}
                {best.rating > 0 && (
                  <p className="text-[11px] text-amber-500 flex items-center justify-end gap-0.5 mt-0.5">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    {best.rating.toFixed(1)}
                  </p>
                )}
              </div>

              {/* Stock */}
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg shrink-0 hidden sm:inline ${
                best.inStock ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"
              }`}>
                {best.inStock ? "มีสินค้า" : "หมด"}
              </span>

              {/* CTA */}
              <a
                href={best.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 transition-all hover:opacity-90"
                style={{ backgroundColor: hex }}
              >
                <ExternalLink size={12} /> ดูสินค้า
              </a>

              {/* Expand toggle */}
              {others.length > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 shrink-0 transition-colors"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span className="hidden md:inline">+{others.length}</span>
                </button>
              )}
            </>
          );
        })()}

        {/* Idle placeholder */}
        {result.status === "idle" && (
          <div className="flex-1 text-sm text-gray-300">รอคิว...</div>
        )}
      </div>

      {/* ── Expanded: other results ────────────────────────────────────────── */}
      {expanded && best && others.map((item, idx) => {
        const price = effectivePrice(item);
        return (
          <div key={idx}
            className="flex items-center gap-4 px-5 py-3 bg-gray-50/80 border-t border-dashed border-gray-100">
            <div className="w-36 shrink-0" />  {/* spacer for platform column */}
            <ProductThumb item={item} size="sm" />
            <p className="flex-1 text-xs text-gray-600 line-clamp-2 min-w-0">{item.name}</p>
            <div className="text-right shrink-0 w-28">
              <p className="text-base font-bold text-gray-700">฿{price.toLocaleString()}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0 hidden sm:inline ${
              item.inStock ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"
            }`}>
              {item.inStock ? "มีสินค้า" : "หมด"}
            </span>
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 shrink-0">
              <ExternalLink size={11} /> ดู
            </a>
            <div className="w-8 shrink-0" />  {/* spacer for expand button */}
          </div>
        );
      })}
    </div>
  );
}

function ProductThumb({ item, size = "md" }: { item: LiveResult; size?: "md" | "sm" }) {
  const [err, setErr] = useState(false);
  const dim = size === "sm" ? "w-10 h-10" : "w-12 h-12";
  return (
    <div className={`${dim} rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden`}>
      {!err && item.image
        ? <img src={proxyImage(item.image)} alt="" onError={() => setErr(true)}
            className="w-full h-full object-contain" />
        : <ShoppingBag size={size === "sm" ? 14 : 18} className="text-gray-200" />
      }
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LiveSearchPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(["lazada", "bnn", "jib"]));
  const [query,           setQuery]           = useState("");
  const [isSearching,     setIsSearching]     = useState(false);
  const [platformResults, setPlatformResults] = useState<Record<string, PlatformResult>>({});
  const [hasSearched,     setHasSearched]     = useState(false);
  const [lastQuery,       setLastQuery]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (id: string) => {
    if (isSearching) return;
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || selectedPlatforms.size === 0 || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    setLastQuery(q);

    const ordered = PLATFORMS.filter((p) => selectedPlatforms.has(p.id));

    // Init all as idle
    const initial: Record<string, PlatformResult> = {};
    ordered.forEach(({ id, label }) => {
      initial[id] = { label, status: "idle", items: [], count: 0 };
    });
    setPlatformResults(initial);

    // Sequential scraping (browser is singleton — concurrent kills shared context)
    for (const { id } of ordered) {
      setPlatformResults((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: "loading" },
      }));
      try {
        const res  = await liveSearchApi.search(q, id);
        const data = res.data as { count: number; results: LiveResult[] };
        setPlatformResults((prev) => ({
          ...prev,
          [id]: { ...prev[id], status: "done", items: data.results, count: data.count },
        }));
      } catch (err: any) {
        setPlatformResults((prev) => ({
          ...prev,
          [id]: { ...prev[id], status: "error", error: err?.response?.data?.message ?? "ค้นหาไม่สำเร็จ" },
        }));
      }
    }
    setIsSearching(false);
  };

  // ── Derived: sort done rows by cheapest price ──────────────────────────────
  const orderedRows = PLATFORMS
    .filter((p) => platformResults[p.id])
    .map((p) => ({ ...p, result: platformResults[p.id] }))
    .sort((a, b) => {
      const priceA = a.result.items[0] ? effectivePrice(a.result.items[0]) : Infinity;
      const priceB = b.result.items[0] ? effectivePrice(b.result.items[0]) : Infinity;
      // Put loading/idle/error after done rows
      if (a.result.status === "done" && b.result.status !== "done") return -1;
      if (b.result.status === "done" && a.result.status !== "done") return 1;
      return priceA - priceB;
    });

  const cheapestId = orderedRows.find(
    (r) => r.result.status === "done" && r.result.count > 0
  )?.id;

  const doneCount  = orderedRows.filter((r) => ["done","error"].includes(r.result.status)).length;
  const totalFound = orderedRows.reduce((s, r) => s + r.result.count, 0);
  const minPrice   = cheapestId && platformResults[cheapestId]?.items[0]
    ? effectivePrice(platformResults[cheapestId].items[0]) : null;
  const maxPrice   = (() => {
    const done = orderedRows.filter((r) => r.result.status === "done" && r.result.items[0]);
    if (done.length < 2) return null;
    return effectivePrice(done[done.length - 1].result.items[0]);
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
            <Telescope size={20} className="text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">เปรียบราคาจากแพลตฟอร์ม</h1>
              <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">
                <Sparkles size={10} /> สมาชิก
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              ค้นหาสินค้าจากหลายแพลตฟอร์มพร้อมกัน เปรียบราคาในที่เดียว
            </p>
          </div>
        </div>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <Clock size={13} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-800">
            แต่ละแพลตฟอร์มใช้เวลา <strong>15–30 วินาที</strong> — ราคาจะทยอยปรากฏทีละแพลตฟอร์ม
          </p>
        </div>
      </div>

      {/* ── Platform Selector ──────────────────────────────────────────────── */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            เลือกแพลตฟอร์ม
            {selectedPlatforms.size > 0 && (
              <span className="ml-2 bg-violet-600 text-white text-[10px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center">
                {selectedPlatforms.size}
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setSelectedPlatforms(new Set(PLATFORMS.map((p) => p.id)))}
              disabled={isSearching}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-40">
              ทั้งหมด
            </button>
            <button onClick={() => setSelectedPlatforms(new Set())} disabled={isSearching}
              className="text-xs text-gray-400 hover:text-red-500 font-semibold disabled:opacity-40">
              ล้าง
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const hex     = PLATFORM_COLORS[p.label] ?? "#6b7280";
            const checked = selectedPlatforms.has(p.id);
            return (
              <button key={p.id} onClick={() => togglePlatform(p.id)} disabled={isSearching}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${
                  checked
                    ? "border-transparent text-white shadow-sm"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
                style={checked ? { backgroundColor: hex } : {}}>
                <PlatformLogo platform={p.label} size={15} />
                {p.label}
                {checked && <CheckCircle2 size={11} className="text-white/80" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search Form ────────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input ref={inputRef} value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์ชื่อสินค้า เช่น iPhone 16 Pro, Sony WH-1000XM6..."
            className="input pl-10 pr-4 w-full"
            disabled={isSearching} />
        </div>
        <button type="submit"
          disabled={isSearching || !query.trim() || selectedPlatforms.size === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
          {isSearching
            ? <><Loader2 size={15} className="animate-spin" /> กำลังค้นหา...</>
            : <><Search size={15} /> เปรียบราคาจาก {selectedPlatforms.size} แพลตฟอร์ม</>
          }
        </button>
      </form>

      {/* ── Comparison Table ───────────────────────────────────────────────── */}
      {hasSearched && (
        <div className="card overflow-hidden">

          {/* Table header */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                เปรียบราคา
                <span className="text-blue-600">"{lastQuery}"</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isSearching
                  ? `${doneCount}/${orderedRows.length} แพลตฟอร์ม · กำลังดึงข้อมูล...`
                  : `${orderedRows.length} แพลตฟอร์ม · พบ ${totalFound} รายการ`
                }
              </p>
            </div>

            {/* Saving summary */}
            {!isSearching && minPrice && maxPrice && maxPrice > minPrice && (
              <div className="text-right">
                <p className="text-xs text-gray-400">ประหยัดได้สูงสุด</p>
                <p className="text-lg font-extrabold text-green-600">
                  ฿{(maxPrice - minPrice).toLocaleString()}
                </p>
              </div>
            )}

            {/* In-progress counter */}
            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 size={14} className="animate-spin" />
                <span className="font-semibold">{doneCount}/{orderedRows.length}</span>
              </div>
            )}
          </div>

          {/* Status chips row */}
          <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5 bg-white">
            {orderedRows.map(({ id, label, result }) => (
              <span key={id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                result.status === "loading" ? "border-blue-200 bg-blue-50 text-blue-600" :
                result.status === "done"    ? "border-green-200 bg-green-50 text-green-700" :
                result.status === "error"   ? "border-red-200 bg-red-50 text-red-500" :
                                              "border-gray-200 bg-gray-50 text-gray-400"
              }`}>
                {result.status === "loading" && <Loader2 size={10} className="animate-spin" />}
                {result.status === "done"    && <CheckCircle2 size={10} />}
                {result.status === "error"   && <XCircle size={10} />}
                {label}
                {result.status === "done" && result.count > 0 && (
                  <span className="font-bold" style={{ color: PLATFORM_COLORS[label] }}>
                    {result.count}
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {orderedRows.map(({ id, result }) => (
              <CompareRow
                key={id}
                platformId={id}
                result={result}
                isCheapest={id === cheapestId}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty initial state ─────────────────────────────────────────────── */}
      {!hasSearched && (
        <div className="card py-16 px-8 text-center">
          <div className="w-20 h-20 bg-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Telescope size={36} className="text-violet-300" />
          </div>
          <h3 className="font-bold text-gray-700 mb-2">เลือกแพลตฟอร์มและค้นหา</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
            ราคาจากทุกแพลตฟอร์มจะแสดงในตารางเดียว เรียงจากถูกสุด พร้อม highlight ราคาดีที่สุด
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["iPhone 16 Pro", "Sony WH-1000XM6", "Nike Air Max 270", "MacBook Air M3"].map((s) => (
              <button key={s}
                onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                className="text-xs bg-gray-100 hover:bg-violet-100 hover:text-violet-700 text-gray-600 px-3 py-1.5 rounded-xl transition-colors font-medium">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
