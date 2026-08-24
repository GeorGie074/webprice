import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TrendingDown, X, ArrowRight } from "lucide-react";
import { wishlistApi } from "../../api";
import { Product, COMING_SOON_PLATFORMS } from "../../types";
import { useAuth } from "../../context/AuthContext";

const PRICE_CACHE_KEY = "pc_wishlist_price_cache";
const TOAST_DURATION  = 6000; // ms

interface DropAlert {
  productId: string;
  name:      string;
  image:     string;
  oldPrice:  number;
  newPrice:  number;
  saving:    number;
  savingPct: number;
}

/* ── Detect price drops against localStorage cache ────────────────────────── */
function detectDrops(products: Product[]): DropAlert[] {
  const cache: Record<string, number> = (() => {
    try { return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || "{}"); }
    catch { return {}; }
  })();

  const drops: DropAlert[] = [];
  const newCache: Record<string, number> = {};

  for (const product of products) {
    const active = product.prices.filter(
      (p) => p.available !== false && !COMING_SOON_PLATFORMS.includes(p.platform)
    );
    if (!active.length) continue;

    const currentMin = Math.min(...active.map((p) => p.price));
    newCache[product._id] = currentMin;

    const lastPrice = cache[product._id];
    if (lastPrice && currentMin < lastPrice) {
      const saving    = lastPrice - currentMin;
      const savingPct = Math.round((saving / lastPrice) * 100);
      drops.push({
        productId: product._id,
        name:      product.nameTh,
        image:     product.image,
        oldPrice:  lastPrice,
        newPrice:  currentMin,
        saving,
        savingPct,
      });
    }
  }

  // Persist latest prices so next visit has fresh baseline
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(newCache));
  return drops;
}

/* ── Single toast card ────────────────────────────────────────────────────── */
function Toast({ alert, onDismiss }: { alert: DropAlert; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
      setProgress(pct);
      if (pct === 0) {
        clearInterval(intervalRef.current!);
        onDismiss();
      }
    }, 40);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line

  return (
    <div
      className="w-80 bg-white rounded-2xl shadow-2xl shadow-gray-900/15 border border-gray-100 overflow-hidden"
      style={{ animation: "toastSlideIn 0.35s cubic-bezier(.22,.68,0,1.2)" }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <TrendingDown size={14} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700">ราคาลดแล้ว! 🎉</p>
              <p className="text-[10px] text-gray-400">รายการโปรดของคุณ</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded-lg hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        </div>

        {/* Product info */}
        <div className="flex items-center gap-3 mb-3">
          <img
            src={alert.image}
            alt={alert.name}
            className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-100 p-1 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/100?text=?"; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
              {alert.name}
            </p>
          </div>
        </div>

        {/* Price comparison */}
        <div className="bg-emerald-50 rounded-xl px-3 py-2.5 flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 line-through">
              ฿{alert.oldPrice.toLocaleString()}
            </span>
            <ArrowRight size={12} className="text-gray-300" />
            <span className="text-base font-extrabold text-emerald-600">
              ฿{alert.newPrice.toLocaleString()}
            </span>
          </div>
          <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
            -{alert.savingPct}%
          </span>
        </div>

        <p className="text-xs text-gray-400 mb-3 text-center">
          ประหยัดได้ <span className="font-bold text-emerald-600">฿{alert.saving.toLocaleString()}</span>
        </p>

        {/* CTA */}
        <Link
          to={`/product/${alert.productId}`}
          onClick={onDismiss}
          className="flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
        >
          ดูราคาและไปซื้อ <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

/* ── Main component — rendered once in UserLayout ─────────────────────────── */
export function PriceDropToast() {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<DropAlert[]>([]);
  const [current, setCurrent] = useState<DropAlert | null>(null);
  const checkedRef = useRef(false);

  const { data: wlData } = useQuery({
    queryKey: ["wishlist"],
    queryFn:  () => wishlistApi.list(),
    enabled:  isAuthenticated,
    staleTime: 60_000,
  });

  // Run detection once when wishlist data arrives
  useEffect(() => {
    if (!wlData?.data || checkedRef.current) return;
    checkedRef.current = true;

    const products: Product[] = wlData.data as Product[];
    const drops = detectDrops(products);
    if (drops.length > 0) {
      setAlerts(drops);
    }
  }, [wlData]);

  // Show next alert whenever queue changes and nothing is showing
  useEffect(() => {
    if (!current && alerts.length > 0) {
      // Small delay before first toast so page feels settled
      const timer = setTimeout(() => {
        setCurrent(alerts[0]);
        setAlerts((prev) => prev.slice(1));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [alerts, current]);

  const dismiss = () => setCurrent(null);

  if (!current) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-3 pointer-events-none">
      <div className="pointer-events-auto">
        <Toast alert={current} onDismiss={dismiss} />
      </div>
    </div>
  );
}
