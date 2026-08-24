import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, alertsApi, wishlistApi } from "../api";
import { Product, COMING_SOON_PLATFORMS } from "../types";
import { proxyImage } from "../utils/imageUrl";
import { PlatformLogo } from "../components/ui/PlatformLogo";
import { PriceHistoryChart } from "../components/ui/PriceHistoryChart";
import SmartBuyingAssistant from "../components/ui/SmartBuyingAssistant";
import { useAuth } from "../context/AuthContext";
import { useCompare } from "../context/CompareContext";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import {
  Star, Bell, CheckCircle, TrendingDown,
  ChevronRight, AlertCircle, Clock, Heart, Flame, Brain,
  ShoppingCart, Tag, RefreshCw, BarChart2, GitCompare, Layers,
} from "lucide-react";
import { ProductCard } from "../components/ui/ProductCard";
import { ProductCardSkeleton } from "../components/ui/ProductCardSkeleton";
import axios from "axios";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { track } = useRecentlyViewed();
  const { add: addCompare, remove: removeCompare, isSelected, isFull } = useCompare();
  const [alertPrice, setAlertPrice]   = useState("");
  const [alertMsg,   setAlertMsg]     = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [activeImg, setActiveImg]     = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });
  const product: Product | undefined = data?.data;

  const { data: relatedData, isLoading: relatedLoading } = useQuery({
    queryKey: ["related", id],
    queryFn: () => productsApi.getRelated(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const relatedProducts: Product[] = relatedData?.data ?? [];

  useEffect(() => { if (id) track(id); }, [id, track]);
  useEffect(() => { setActiveImg(0); }, [id]);

  // Wishlist ────────────────────────────────────────────────────────────────
  const { data: wlData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => wishlistApi.list(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const wishlisted = (wlData?.data as { _id: string }[] | undefined)?.some((p) => p._id === id) ?? false;
  const addWl    = useMutation({ mutationFn: () => wishlistApi.add(id!),    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }) });
  const removeWl = useMutation({ mutationFn: () => wishlistApi.remove(id!), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }) });

  const handleSetAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertPrice) return;
    setAlertLoading(true);
    setAlertMsg(null);
    try {
      await alertsApi.create(id!, Number(alertPrice));
      setAlertMsg({ type: "success", text: `ตั้งการแจ้งเตือนที่ราคา ฿${Number(alertPrice).toLocaleString()} แล้ว!` });
      setAlertPrice("");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setAlertMsg({ type: "error", text: err.response?.data?.message || "เกิดข้อผิดพลาด" });
      }
    } finally {
      setAlertLoading(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-64 mb-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-100 rounded-3xl aspect-square" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-100 rounded w-1/4" />
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-6 bg-gray-100 rounded w-2/3" />
            <div className="h-24 bg-gray-50 rounded-2xl" />
            <div className="h-12 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 text-lg mb-3">ไม่พบสินค้า</p>
        <Link to="/" className="btn-primary inline-flex">กลับหน้าหลัก</Link>
      </div>
    );
  }

  // ── Data prep ─────────────────────────────────────────────────────────────
  const sortedPrices = [...product.prices]
    .filter((p) => p.available !== false)
    .sort((a, b) => {
      const aCS = COMING_SOON_PLATFORMS.includes(a.platform);
      const bCS = COMING_SOON_PLATFORMS.includes(b.platform);
      if (aCS && !bCS) return 1;
      if (!aCS && bCS) return -1;
      return a.price - b.price;
    });

  const cheapest = sortedPrices.find((p) => !COMING_SOON_PLATFORMS.includes(p.platform)) ?? sortedPrices[0];
  const mostExpensive = [...sortedPrices].filter((p) => !COMING_SOON_PLATFORMS.includes(p.platform)).slice(-1)[0];
  const activePlatforms = sortedPrices.filter((p) => !COMING_SOON_PLATFORMS.includes(p.platform));
  const maxSaving = cheapest && mostExpensive ? mostExpensive.price - cheapest.price : 0;

  const histMin = product.priceHistory?.length
    ? Math.min(...product.priceHistory.map((s) => s.minPrice))
    : null;
  const isATL = histMin !== null && cheapest.price <= histMin;

  const images = [product.image, ...(product.images ?? []).filter((img) => img !== product.image)];
  const lastScraped = product.lastScraped
    ? new Intl.RelativeTimeFormat("th", { numeric: "auto" }).format(
        -Math.round((Date.now() - new Date(product.lastScraped).getTime()) / 3_600_000),
        "hour"
      )
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-blue-600 transition-colors">หน้าหลัก</Link>
        <ChevronRight size={13} />
        <Link to="/search" className="hover:text-blue-600 transition-colors">สินค้า</Link>
        <ChevronRight size={13} />
        <span className="text-gray-600 truncate max-w-[200px]">{product.nameTh}</span>
      </nav>

      {/* ── Top grid: image + info ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">

        {/* Image gallery */}
        <div className="space-y-3">
          <div className="card p-6 flex items-center justify-center bg-white rounded-3xl overflow-hidden aspect-square relative group">
            <img
              src={proxyImage(images[activeImg] ?? product.image)}
              alt={product.nameTh}
              className="max-h-full max-w-full object-contain transition-opacity duration-300"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
            />
            {isATL && (
              <div className="absolute top-3 left-3 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                <Flame size={10} className="fill-white" /> ราคาต่ำสุดตลอดกาล
              </div>
            )}
            {lastScraped && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-gray-400 bg-white/90 backdrop-blur px-2 py-1 rounded-full border border-gray-100">
                <RefreshCw size={9} /> อัปเดต {lastScraped}
              </div>
            )}
          </div>
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.slice(0, 6).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-14 h-14 rounded-xl border-2 overflow-hidden transition-all ${
                    activeImg === i ? "border-blue-500 shadow-sm shadow-blue-200" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain p-1"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/56x56?text=?"; }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-4">

          {/* Brand + title + wishlist + compare */}
          <div>
            <p className="text-sm text-blue-600 font-semibold mb-1">{product.brand}</p>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-900 leading-snug">{product.nameTh}</h1>
              <div className="flex flex-col gap-2 shrink-0">
                {isAuthenticated && (
                  <button
                    onClick={() => wishlisted ? removeWl.mutate() : addWl.mutate()}
                    disabled={addWl.isPending || removeWl.isPending}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      wishlisted
                        ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                        : "bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-400"
                    }`}
                  >
                    <Heart size={15} className={wishlisted ? "fill-red-500 text-red-500" : ""} />
                    {wishlisted ? "บันทึกแล้ว" : "บันทึก"}
                  </button>
                )}
                {/* Compare button */}
                {product && (() => {
                  const sel = isSelected(product._id);
                  return (
                    <button
                      onClick={() => sel ? removeCompare(product._id) : addCompare(product)}
                      disabled={!sel && isFull}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        sel
                          ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                      }`}
                      title={!sel && isFull ? "เลือกได้สูงสุด 3 รายการ" : ""}
                    >
                      <GitCompare size={14} />
                      {sel ? "เปรียบอยู่" : "เปรียบเทียบ"}
                    </button>
                  );
                })()}
              </div>
            </div>
            {product.description && (
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">{product.description}</p>
            )}
          </div>

          {/* Best price highlight — raw cheapest price */}
          <div className={`rounded-2xl p-4 border ${isATL ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-100"}`}>
            <p className={`text-xs font-semibold mb-0.5 ${isATL ? "text-orange-500" : "text-blue-500"}`}>
              ราคาต่ำสุดตอนนี้
            </p>
            <div className="flex items-end gap-3">
              <p className={`text-4xl font-extrabold leading-none ${isATL ? "text-orange-600" : "text-blue-700"}`}>
                ฿{cheapest.price.toLocaleString()}
              </p>
              {cheapest.originalPrice > cheapest.price && (
                <p className="text-gray-400 line-through text-sm mb-1">
                  ฿{cheapest.originalPrice.toLocaleString()}
                </p>
              )}
            </div>
            <p className={`text-sm mt-1 flex items-center gap-1.5 ${isATL ? "text-orange-500" : "text-blue-500"}`}>
              จาก <span className="font-bold">{cheapest.platform}</span>
              {cheapest.shipping === 0 && (
                <span className="badge bg-green-100 text-green-700 text-[10px]">ฟรีส่ง</span>
              )}
            </p>
          </div>

          {/* Coupon section disabled — re-enable when data source is verified */}

          {/* Quick stats strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-[10px] text-gray-400 mb-0.5">เปรียบ</p>
              <p className="text-lg font-bold text-gray-900">{activePlatforms.length}</p>
              <p className="text-[10px] text-gray-400">แพลตฟอร์ม</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
              <p className="text-[10px] text-gray-400 mb-0.5">ประหยัดสูงสุด</p>
              <p className="text-lg font-bold text-emerald-600">฿{maxSaving.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">เมื่อเทียบแพง</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-[10px] text-gray-400 mb-0.5">ลด</p>
              <p className="text-lg font-bold text-gray-900">
                {cheapest.originalPrice > cheapest.price
                  ? `${Math.round(((cheapest.originalPrice - cheapest.price) / cheapest.originalPrice) * 100)}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-gray-400">จากราคาปก</p>
            </div>
          </div>

          {/* AI Assistant CTA */}
          <button
            onClick={() => setShowAssistant(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 hover:border-blue-400 hover:from-blue-100 hover:to-purple-100 transition-all group"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Brain size={15} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-gray-800">🤖 วิเคราะห์ราคาอัจฉริยะ</p>
              <p className="text-xs text-gray-400">ดูแนวโน้ม · คาดการณ์ราคา · แนะนำเวลาซื้อ</p>
            </div>
            <span className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2.5 py-1 rounded-full font-semibold shrink-0">
              Smart AI
            </span>
          </button>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <Tag size={12} className="text-gray-300" />
              {product.tags.map((tag) => (
                <span key={tag} className="badge bg-gray-100 text-gray-500">#{tag}</span>
              ))}
            </div>
          )}

          {/* Price alert */}
          {isAuthenticated ? (
            <div className="card p-4">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Bell size={15} className="text-blue-500" /> ตั้งการแจ้งเตือนราคา
              </p>
              <form onSubmit={handleSetAlert} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
                  <input
                    type="number" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)}
                    placeholder={`เช่น ${Math.round(cheapest.price * 0.9).toLocaleString()}`}
                    min="1" max={cheapest.price} required
                    className="input pl-7"
                  />
                </div>
                <button type="submit" disabled={alertLoading} className="btn-primary shrink-0">
                  {alertLoading ? "..." : "แจ้งเตือน"}
                </button>
              </form>
              {alertMsg && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${alertMsg.type === "success" ? "text-green-700" : "text-red-600"}`}>
                  {alertMsg.type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {alertMsg.text}
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Bell size={14} /> เข้าสู่ระบบเพื่อตั้งการแจ้งเตือนราคา
            </Link>
          )}
        </div>
      </div>

      {/* ── Price comparison cards ─────────────────────────────────────────── */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-500" />
            <h2 className="font-bold text-gray-900">เปรียบราคาจาก {activePlatforms.length} ร้านค้า</h2>
          </div>
          {maxSaving > 0 && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
              ประหยัดได้ถึง ฿{maxSaving.toLocaleString()}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          {sortedPrices.map((p, idx) => {
            const isCS      = COMING_SOON_PLATFORMS.includes(p.platform);
            const isBest    = !isCS && p.price === cheapest.price;
            const discountPct = p.originalPrice > p.price
              ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
            const overBest  = !isCS && !isBest && cheapest
              ? Math.round(((p.price - cheapest.price) / cheapest.price) * 100) : 0;

            return (
              <div
                key={idx}
                className={`rounded-2xl border p-4 transition-all ${
                  isCS    ? "bg-gray-50/60 border-gray-100 opacity-55" :
                  isBest  ? "bg-emerald-50 border-emerald-200 shadow-sm" :
                  "bg-white border-gray-100 hover:border-blue-100 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <PlatformLogo platform={p.platform} size={40} grayscale={isCS} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`font-semibold text-sm ${isCS ? "text-gray-400" : "text-gray-900"}`}>
                        {p.platform}
                      </p>
                      {isBest && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          <CheckCircle size={9} /> ถูกที่สุด
                        </span>
                      )}
                      {isCS && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                          <Clock size={9} /> เร็วๆ นี้
                        </span>
                      )}
                    </div>

                    {!isCS && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          {p.rating.toFixed(1)}
                          <span className="text-gray-300 ml-0.5">({p.reviews.toLocaleString()})</span>
                        </span>
                        <span className="text-gray-200">·</span>
                        {p.shipping === 0
                          ? <span className="text-emerald-500 font-medium">ฟรีส่ง</span>
                          : <span>ส่ง ฿{p.shipping}</span>}
                        <span className="text-gray-200">·</span>
                        {p.inStock
                          ? <span className="text-gray-500">มีสินค้า</span>
                          : <span className="text-red-400">หมด</span>}
                      </div>
                    )}
                  </div>

                  {/* Price + buy button */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    {isCS ? (
                      <span className="text-gray-300 text-sm">—</span>
                    ) : (
                      <>
                        <div>
                          <p className="text-xl font-extrabold text-gray-900 leading-none">
                            ฿{p.price.toLocaleString()}
                          </p>
                          {discountPct > 0 && (
                            <p className="text-xs text-red-400 mt-0.5 flex items-center justify-end gap-1">
                              <span className="line-through text-gray-300">฿{p.originalPrice.toLocaleString()}</span>
                              <span className="font-semibold">-{discountPct}%</span>
                            </p>
                          )}
                          {overBest > 0 && (
                            <p className="text-[10px] text-gray-400 mt-0.5">+{overBest}% กว่าถูกสุด</p>
                          )}
                        </div>
                        {/* Coupon badge disabled — re-enable when data source is verified */}
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                            isBest
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                              : "bg-blue-600 hover:bg-blue-500 text-white"
                          }`}
                        >
                          <ShoppingCart size={11} /> ไปซื้อ
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
          <TrendingDown size={12} className="text-gray-300" />
          ราคาอาจมีการเปลี่ยนแปลง กรุณาตรวจสอบราคาก่อนซื้อเสมอ
        </div>
      </div>

      {/* ── Price History Chart ────────────────────────────────────────────── */}
      <PriceHistoryChart productId={id!} />

      {/* ── Smart Buying Assistant modal ──────────────────────────────────── */}
      {showAssistant && (
        <SmartBuyingAssistant
          productId={id!}
          productName={product.nameTh}
          priceHistory={product.priceHistory ?? []}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {/* ── Related Products ──────────────────────────────────────────────── */}
      {(relatedLoading || relatedProducts.length > 0) && (
        <section className="mt-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <Layers size={15} className="text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg leading-none">สินค้าที่ใกล้เคียง</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {product.category && `หมวด ${product.category} · `}เปรียบราคาสินค้าอื่นในกลุ่มเดียวกัน
                </p>
              </div>
            </div>
            <Link
              to={`/search?category=${product.category}`}
              className="flex items-center gap-1 text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              ดูทั้งหมด <ChevronRight size={15} />
            </Link>
          </div>

          {/* Cards grid */}
          {relatedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
