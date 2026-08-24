import { Link } from "react-router-dom";
import { Star, TrendingDown, Heart, GitCompare, Clock, Store } from "lucide-react";
import { Product, COMING_SOON_PLATFORMS, PLATFORM_COLORS } from "../../types";
import { proxyImage } from "../../utils/imageUrl";
import { PlatformLogo } from "./PlatformLogo";
import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wishlistApi } from "../../api";
import { useCompare } from "../../context/CompareContext";

// ── Badge system ──────────────────────────────────────────────────────────────

const OFFICIAL_STORES = new Set([
  "Apple Store", "Samsung Shop", "Sony Store",
  "Dyson Store", "Nike.com", "Studio 7",
]);

type BadgeConfig = {
  emoji: string;
  label: string;
  gradient: string;
  text: string;
};

function getSpecialBadge(
  allTimeLow: boolean,
  discount: number,
  bestPlatform: string | undefined,
  totalReviews: number,
): BadgeConfig | null {
  if (allTimeLow)
    return { emoji: "🔥", label: "ราคาดีสุดวันนี้",  gradient: "from-orange-500 to-red-500",    text: "text-white" };
  if (discount >= 30)
    return { emoji: "⚡", label: "Flash Sale",        gradient: "from-yellow-400 to-orange-500", text: "text-white" };
  if (discount >= 15)
    return { emoji: "📉", label: "ลดแรง",             gradient: "from-rose-500 to-pink-500",     text: "text-white" };
  if (bestPlatform && OFFICIAL_STORES.has(bestPlatform))
    return { emoji: "💎", label: "Official Store",    gradient: "from-blue-600 to-indigo-600",   text: "text-white" };
  if (totalReviews >= 500)
    return { emoji: "🏆", label: "Best Seller",       gradient: "from-amber-500 to-yellow-400",  text: "text-white" };
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAllTimeLow(product: Product, currentPrice: number): boolean {
  if (!product.priceHistory || product.priceHistory.length < 2) return false;
  const historicalMin = Math.min(...product.priceHistory.map((s) => s.minPrice));
  return currentPrice <= historicalMin;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}ว`;
  if (h > 0) return `${h}ชม`;
  if (m > 0) return `${m}น`;
  return "เมื่อกี้";
}

// ── Platform color chip ───────────────────────────────────────────────────────

function PlatformChip({ platform }: { platform: string }) {
  const hex = PLATFORM_COLORS[platform] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ backgroundColor: `${hex}18`, color: hex }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hex }}
      />
      {platform}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductCard({ product }: { product: Product }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { add, remove: removeCompare, isSelected, isFull } = useCompare();
  const selected = isSelected(product._id);

  const activePrices = product.prices.filter(
    (p) => !COMING_SOON_PLATFORMS.includes(p.platform) && p.available !== false
  );
  const minActivePrice =
    activePrices.length > 0
      ? Math.min(...activePrices.map((p) => p.price))
      : product.minPrice;
  const bestPrice = activePrices.find((p) => p.price === minActivePrice);
  const discount = bestPrice
    ? Math.round(((bestPrice.originalPrice - bestPrice.price) / bestPrice.originalPrice) * 100)
    : 0;
  const savings = bestPrice ? bestPrice.originalPrice - bestPrice.price : 0;
  const allTimeLow = isAllTimeLow(product, minActivePrice);
  const totalReviews = activePrices.reduce((sum, p) => sum + (p.reviews ?? 0), 0);
  const badge = getSpecialBadge(allTimeLow, discount, bestPrice?.platform, totalReviews);

  // ── Wishlist ──────────────────────────────────────────────────────────────
  const { data: wlData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => wishlistApi.list(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const wishlisted =
    (wlData?.data as { _id: string }[] | undefined)?.some((p) => p._id === product._id) ?? false;

  const addMutation    = useMutation({ mutationFn: () => wishlistApi.add(product._id),    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }) });
  const removeMutation = useMutation({ mutationFn: () => wishlistApi.remove(product._id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }) });

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuthenticated) return;
    if (wishlisted) removeMutation.mutate(); else addMutation.mutate();
  };
  const toggleCompare = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (selected) removeCompare(product._id); else add(product);
  };

  return (
    <Link to={`/product/${product._id}`} className="group">
      <div
        className={`card overflow-hidden transition-all duration-200 h-full flex flex-col
          hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200
          ${badge ? "ring-1 ring-inset ring-transparent hover:ring-orange-100" : ""}`}
      >
        {/* ── Special badge strip ─────────────────────────────────────── */}
        {badge && (
          <div className={`bg-gradient-to-r ${badge.gradient} ${badge.text} px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold`}>
            <span className="text-sm leading-none">{badge.emoji}</span>
            <span className="flex-1">{badge.label}</span>
            {discount > 0 && (
              <span className="bg-white/25 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold">
                -{discount}%
              </span>
            )}
          </div>
        )}

        <div className="p-4 flex flex-col flex-1">
          {/* ── Image ─────────────────────────────────────────────────── */}
          <div className="relative bg-gray-50 rounded-lg overflow-hidden mb-3 aspect-square">
            <img
              src={proxyImage(product.image)}
              alt={product.nameTh}
              className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder-product.svg";
                (e.target as HTMLImageElement).onerror = null;
              }}
            />

            {/* Discount badge (only when no special strip) */}
            {!badge && discount > 0 && (
              <span className="absolute top-2 left-2 badge bg-red-100 text-red-700 text-[10px]">
                -{discount}%
              </span>
            )}
            {product.featured && !badge && (
              <span className="absolute top-2 right-2 badge bg-blue-100 text-blue-700 text-[10px]">แนะนำ</span>
            )}

            {/* Compare button */}
            <button
              onClick={toggleCompare}
              disabled={!selected && isFull}
              className={`absolute bottom-2 left-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-all
                ${selected
                  ? "bg-blue-600 text-white opacity-100"
                  : "bg-white/90 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={selected ? "เอาออกจากการเปรียบเทียบ" : isFull ? "เลือกได้สูงสุด 3 รายการ" : "เปรียบเทียบสินค้า"}
            >
              <GitCompare size={12} />
            </button>

            {/* Wishlist button */}
            {isAuthenticated && (
              <button
                onClick={toggleWishlist}
                disabled={addMutation.isPending || removeMutation.isPending}
                className={`absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-all
                  ${wishlisted
                    ? "bg-red-500 text-white"
                    : "bg-white/90 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  }`}
                title={wishlisted ? "นำออกจากรายการโปรด" : "บันทึกในรายการโปรด"}
              >
                <Heart size={13} className={wishlisted ? "fill-white" : ""} />
              </button>
            )}
          </div>

          {/* ── Info ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 font-medium">{product.brand}</p>
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
              {product.nameTh}
            </h3>

            {/* Store count row */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Store size={10} className="text-gray-300" />
                {activePrices.length} ร้านค้า
              </span>
              {product.lastScraped && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Clock size={10} className="text-gray-300" />
                  {timeAgo(product.lastScraped)}
                </span>
              )}
            </div>

            {/* ── Price row ─────────────────────────────────────────── */}
            <div className="mt-auto pt-3 border-t border-gray-50 space-y-1.5">
              {/* Price + savings */}
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className={`text-lg font-extrabold leading-none ${
                      allTimeLow ? "text-orange-500" : "text-blue-600"
                    }`}
                  >
                    ฿{minActivePrice.toLocaleString()}
                  </p>
                  {savings > 0 && (
                    <p className="text-[10px] text-green-600 font-semibold mt-0.5 flex items-center gap-0.5">
                      <TrendingDown size={10} />
                      ลด ฿{savings.toLocaleString()}
                    </p>
                  )}
                </div>
                {bestPrice && (
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs text-gray-500 font-medium">{bestPrice.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Platform chip */}
              {bestPrice && (
                <div className="flex items-center gap-1.5">
                  <PlatformChip platform={bestPrice.platform} />
                  <PlatformLogo platform={bestPrice.platform} size={14} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
