import { useSearchParams, Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { productsApi } from "../api";
import { Product, PLATFORM_COLORS, COMING_SOON_PLATFORMS } from "../types";
import { proxyImage } from "../utils/imageUrl";
import { PlatformLogo } from "../components/ui/PlatformLogo";
import {
  Check, X, Minus, Star, ShoppingCart, ArrowLeft, GitCompare,
} from "lucide-react";

/* ── helpers ──────────────────────────────────────────────────────────────── */
function getActivePrices(p: Product) {
  return p.prices.filter(
    (pr) => pr.available !== false && !COMING_SOON_PLATFORMS.includes(pr.platform)
  );
}
function getBestPrice(p: Product) {
  const active = getActivePrices(p);
  if (!active.length) return null;
  return active.reduce((a, b) => (a.price < b.price ? a : b));
}
function getDiscount(p: Product) {
  const best = getBestPrice(p);
  if (!best || !best.originalPrice) return 0;
  return Math.round(((best.originalPrice - best.price) / best.originalPrice) * 100);
}

/* ── Row wrapper ──────────────────────────────────────────────────────────── */
function Row({ label, children, accent = false }: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`grid divide-x divide-gray-100 ${accent ? "bg-blue-50/40" : "bg-white even:bg-gray-50/50"}`}
      style={{ gridTemplateColumns: `160px repeat(var(--cols), minmax(140px, 1fr))`, minWidth: "420px" }}
    >
      <div className="px-4 py-3 text-xs font-semibold text-gray-500 flex items-center">
        {label}
      </div>
      {children}
    </div>
  );
}

/* ── Cell wrapper ─────────────────────────────────────────────────────────── */
function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3 text-sm text-gray-800 flex items-center justify-center text-center ${className}`}>
      {children}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["product", id],
      queryFn: () => productsApi.getById(id),
      staleTime: 5 * 60_000,
    })),
  });

  const loading = results.some((r) => r.isLoading);
  const products: Product[] = results
    .map((r) => r.data?.data as Product | undefined)
    .filter(Boolean) as Product[];

  // All platforms that appear in any product
  const allPlatforms = [
    ...new Set(
      products.flatMap((p) =>
        getActivePrices(p).map((pr) => pr.platform)
      )
    ),
  ].sort();

  const cols = ids.length;

  if (!ids.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <GitCompare size={48} className="text-gray-200 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-700 mb-2">ไม่มีสินค้าสำหรับเปรียบเทียบ</h1>
        <p className="text-sm text-gray-400 mb-6">เลือกสินค้าสูงสุด 3 รายการจากหน้าค้นหา</p>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={14} /> ไปเลือกสินค้า
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4 animate-pulse">
        <div className="h-7 w-48 bg-gray-100 rounded" />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {ids.map((id) => (
            <div key={id} className="card p-5 space-y-3">
              <div className="aspect-square bg-gray-100 rounded-xl" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-6 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/search"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} /> กลับค้นหา
        </Link>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-blue-500" />
          <h1 className="font-bold text-gray-900">เปรียบเทียบ {products.length} สินค้า</h1>
        </div>
      </div>

      {/* Product header cards */}
      {(() => {
        const minPriceVal = Math.min(
          ...products.map((p) => getBestPrice(p)?.price ?? Infinity)
        );
        const hasMultiplePrices = products.some(
          (p) => (getBestPrice(p)?.price ?? Infinity) > minPriceVal
        );
        return (
          <div
            className="grid gap-4 mb-6"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {products.map((p) => {
              const best = getBestPrice(p);
              const discount = getDiscount(p);
              const isCheapest = hasMultiplePrices && best !== null && best.price === minPriceVal;
              return (
                <div
                  key={p._id}
                  className={`card p-5 flex flex-col items-center text-center relative ${isCheapest ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
                >
                  {isCheapest && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      ถูกที่สุด
                    </span>
                  )}
                  <div className="w-28 h-28 bg-gray-50 rounded-2xl overflow-hidden mb-3 flex items-center justify-center p-2">
                    <img
                      src={proxyImage(p.image)}
                      alt={p.nameTh}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-product.svg";
                        (e.target as HTMLImageElement).onerror = null;
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mb-0.5">{p.brand}</p>
                  <Link
                    to={`/product/${p._id}`}
                    className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2 mb-2"
                  >
                    {p.nameTh}
                  </Link>
                  {best && (
                    <>
                      <p className="text-2xl font-extrabold text-blue-600 mb-1">
                        ฿{best.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1.5 mb-3">
                        {discount > 0 && (
                          <span className="badge bg-red-100 text-red-600 text-[10px]">
                            -{discount}%
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-xs text-gray-500">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          {best.rating.toFixed(1)}
                        </span>
                        <PlatformLogo platform={best.platform} size={14} />
                      </div>
                      <a
                        href={best.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 w-full justify-center bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <ShoppingCart size={12} /> ไปซื้อที่ {best.platform}
                      </a>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Comparison table — horizontal scroll on mobile */}
      <div
        className="card overflow-hidden"
        style={{ "--cols": cols } as React.CSSProperties}
      >
        <div className="overflow-x-auto">
        {/* Table header */}
        <div
          className="grid bg-gray-50 border-b border-gray-100 divide-x divide-gray-100"
          style={{ gridTemplateColumns: `160px repeat(${cols}, minmax(140px, 1fr))`, minWidth: "420px" }}
        >
          <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
            รายละเอียด
          </div>
          {products.map((p) => (
            <div key={p._id} className="px-4 py-3 text-xs font-bold text-gray-700 text-center truncate">
              {p.nameTh}
            </div>
          ))}
        </div>

        {/* ── ราคาต่ำสุด ────────────────────────────────────────────────── */}
        <Row label="ราคาต่ำสุด" accent>
          {products.map((p) => {
            const best = getBestPrice(p);
            return (
              <Cell key={p._id}>
                <span className="text-lg font-extrabold text-blue-600">
                  {best ? `฿${best.price.toLocaleString()}` : "—"}
                </span>
              </Cell>
            );
          })}
        </Row>

        {/* ── ราคาต่อ Platform ──────────────────────────────────────────── */}
        {allPlatforms.map((platform) => (
          <Row key={platform} label={platform}>
            {products.map((p) => {
              const pr = getActivePrices(p).find(
                (pr) => pr.platform === platform
              );
              const color = PLATFORM_COLORS[platform] || "#6b7280";
              return (
                <Cell key={p._id}>
                  {pr ? (
                    <span className="font-semibold" style={{ color }}>
                      ฿{pr.price.toLocaleString()}
                    </span>
                  ) : (
                    <Minus size={14} className="text-gray-300 mx-auto" />
                  )}
                </Cell>
              );
            })}
          </Row>
        ))}

        {/* ── ส่วนลด ────────────────────────────────────────────────────── */}
        <Row label="ส่วนลดสูงสุด">
          {products.map((p) => {
            const d = getDiscount(p);
            return (
              <Cell key={p._id}>
                {d > 0 ? (
                  <span className="badge bg-red-100 text-red-600 font-bold">
                    -{d}%
                  </span>
                ) : (
                  <Minus size={14} className="text-gray-300 mx-auto" />
                )}
              </Cell>
            );
          })}
        </Row>

        {/* ── คะแนนรีวิว ────────────────────────────────────────────────── */}
        <Row label="คะแนนรีวิว" accent>
          {products.map((p) => {
            const best = getBestPrice(p);
            return (
              <Cell key={p._id}>
                {best ? (
                  <span className="flex items-center gap-1">
                    <Star size={13} className="text-amber-400 fill-amber-400" />
                    <span className="font-bold">{best.rating.toFixed(1)}</span>
                    <span className="text-gray-400 text-xs">({best.reviews.toLocaleString()})</span>
                  </span>
                ) : (
                  <Minus size={14} className="text-gray-300 mx-auto" />
                )}
              </Cell>
            );
          })}
        </Row>

        {/* ── มีสินค้า ───────────────────────────────────────────────────── */}
        <Row label="มีสินค้า">
          {products.map((p) => {
            const best = getBestPrice(p);
            return (
              <Cell key={p._id}>
                {best?.inStock ? (
                  <Check size={16} className="text-green-500 mx-auto" />
                ) : (
                  <X size={16} className="text-red-400 mx-auto" />
                )}
              </Cell>
            );
          })}
        </Row>

        {/* ── ค่าส่ง ─────────────────────────────────────────────────────── */}
        <Row label="ค่าส่ง (ราคาต่ำสุด)">
          {products.map((p) => {
            const best = getBestPrice(p);
            return (
              <Cell key={p._id}>
                <span className="text-xs">
                  {best
                    ? best.shipping === 0
                      ? <span className="text-green-600 font-semibold">ฟรี</span>
                      : `฿${best.shipping.toLocaleString()}`
                    : "—"}
                </span>
              </Cell>
            );
          })}
        </Row>

        {/* ── หมวดหมู่ ───────────────────────────────────────────────────── */}
        <Row label="หมวดหมู่" accent>
          {products.map((p) => (
            <Cell key={p._id}>
              <span className="text-xs text-gray-600 capitalize">{p.category}</span>
            </Cell>
          ))}
        </Row>

        {/* ── แท็ก ───────────────────────────────────────────────────────── */}
        <Row label="แท็กสินค้า">
          {products.map((p) => (
            <Cell key={p._id}>
              <div className="flex flex-wrap gap-1 justify-center">
                {p.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Cell>
          ))}
        </Row>
        </div>{/* end overflow-x-auto */}
      </div>

      <p className="text-xs text-gray-300 text-center mt-4">
        ราคาอาจเปลี่ยนแปลงได้ตามเวลา — ตรวจสอบราคาล่าสุดที่ร้านค้าก่อนซื้อ
      </p>
    </div>
  );
}
