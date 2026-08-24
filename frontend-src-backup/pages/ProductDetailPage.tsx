import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productsApi, alertsApi } from "../api";
import { Product, PLATFORM_COLORS } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  Star, ExternalLink, Bell, CheckCircle, TrendingDown,
  Package, Truck, ChevronRight, AlertCircle
} from "lucide-react";
import axios from "axios";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [alertPrice, setAlertPrice] = useState("");
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });

  const product: Product | undefined = data?.data;

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

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-100 rounded-2xl aspect-square" />
          <div className="space-y-4">
            <div className="h-5 bg-gray-100 rounded w-1/4" />
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-8 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">ไม่พบสินค้า</p>
        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">กลับหน้าหลัก</Link>
      </div>
    );
  }

  const sortedPrices = [...product.prices].sort((a, b) => a.price - b.price);
  const cheapest = sortedPrices[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-blue-600 transition-colors">หน้าหลัก</Link>
        <ChevronRight size={13} />
        <Link to="/search" className="hover:text-blue-600 transition-colors">สินค้า</Link>
        <ChevronRight size={13} />
        <span className="text-gray-600 truncate max-w-xs">{product.nameTh}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Image */}
        <div className="card p-6 flex items-center justify-center aspect-square">
          <img src={product.image} alt={product.nameTh}
            className="max-h-full max-w-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=No+Image"; }}
          />
        </div>

        {/* Info */}
        <div>
          <p className="text-sm text-blue-600 font-semibold mb-1">{product.brand}</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.nameTh}</h1>
          <p className="text-gray-500 text-sm mb-4">{product.description}</p>

          {/* Best price */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
            <p className="text-xs text-blue-500 font-medium mb-1">ราคาต่ำสุดตอนนี้</p>
            <p className="text-3xl font-extrabold text-blue-700">
              ฿{cheapest.price.toLocaleString()}
            </p>
            <p className="text-sm text-blue-500 mt-0.5 flex items-center gap-1">
              <span>จาก</span>
              <span className="font-semibold">{cheapest.platform}</span>
              {cheapest.shipping === 0 && <span className="badge bg-green-100 text-green-700 ml-1">ฟรีส่ง</span>}
            </p>
          </div>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {product.tags.map((tag) => (
                <span key={tag} className="badge bg-gray-100 text-gray-500">#{tag}</span>
              ))}
            </div>
          )}

          {/* Price Alert */}
          {isAuthenticated ? (
            <div className="card p-4">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Bell size={16} className="text-blue-500" />
                ตั้งการแจ้งเตือนราคา
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

      {/* ─── Price Comparison Table ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingDown size={18} className="text-blue-500" />
          <h2 className="font-bold text-gray-900">เปรียบราคาจาก {product.prices.length} ร้านค้า</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-6 py-3 font-medium">ร้านค้า</th>
                <th className="text-right px-4 py-3 font-medium">ราคา</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">ราคาเดิม</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">ส่งฟรี</th>
                <th className="text-center px-4 py-3 font-medium">สต็อก</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">เรตติ้ง</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedPrices.map((p, idx) => {
                const isCheapest = p.price === cheapest.price;
                const discountPct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
                const color = PLATFORM_COLORS[p.platform] || "#6b7280";
                return (
                  <tr key={idx} className={`transition-colors ${isCheapest ? "bg-blue-50/50" : "hover:bg-gray-50"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <p className="font-semibold text-gray-900">{p.platform}</p>
                          {isCheapest && (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle size={10} /> ถูกที่สุด
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-bold text-gray-900 text-base">฿{p.price.toLocaleString()}</p>
                      {discountPct > 0 && (
                        <span className="text-xs text-red-500 font-medium">-{discountPct}%</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-400 line-through text-xs hidden sm:table-cell">
                      {discountPct > 0 ? `฿${p.originalPrice.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-4 text-center hidden sm:table-cell">
                      {p.shipping === 0
                        ? <span className="badge bg-green-100 text-green-700">ฟรี</span>
                        : <span className="text-gray-400 text-xs">฿{p.shipping}</span>
                      }
                    </td>
                    <td className="px-4 py-4 text-center">
                      {p.inStock
                        ? <span className="badge bg-green-100 text-green-700 flex items-center gap-1 justify-center"><Package size={10} />มีสินค้า</span>
                        : <span className="badge bg-red-100 text-red-500">หมด</span>
                      }
                    </td>
                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-gray-600">{p.rating.toFixed(1)}</span>
                        <span className="text-gray-300 text-xs">({p.reviews.toLocaleString()})</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-semibold hover:underline">
                        ไปซื้อ <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Shipping note */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
          <Truck size={12} />
          ราคาอาจมีการเปลี่ยนแปลง กรุณาตรวจสอบก่อนซื้อ
        </div>
      </div>
    </div>
  );
}
