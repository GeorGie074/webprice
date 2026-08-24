import { Link } from "react-router-dom";
import { Star, TrendingDown } from "lucide-react";
import { Product } from "../../types";

export function ProductCard({ product }: { product: Product }) {
  const bestPrice = product.prices.find((p) => p.price === product.minPrice);
  const discount = bestPrice
    ? Math.round(((bestPrice.originalPrice - bestPrice.price) / bestPrice.originalPrice) * 100)
    : 0;

  return (
    <Link to={`/product/${product._id}`} className="group">
      <div className="card p-4 hover:shadow-md hover:border-blue-100 transition-all duration-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative bg-gray-50 rounded-xl overflow-hidden mb-3 aspect-square">
          <img
            src={product.image}
            alt={product.nameTh}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=No+Image"; }}
          />
          {discount > 0 && (
            <span className="absolute top-2 left-2 badge bg-red-100 text-red-700">
              -{discount}%
            </span>
          )}
          {product.featured && (
            <span className="absolute top-2 right-2 badge bg-blue-100 text-blue-700">
              แนะนำ
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col">
          <p className="text-xs text-gray-400 mb-0.5">{product.brand}</p>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {product.nameTh}
          </h3>

          {/* Platform count */}
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
            <TrendingDown size={12} className="text-green-500" />
            เปรียบราคาจาก {product.prices.length} ร้านค้า
          </p>

          {/* Price */}
          <div className="mt-auto pt-3 border-t border-gray-50 flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-400">ราคาต่ำสุด</p>
              <p className="text-lg font-bold text-blue-600">
                ฿{product.minPrice.toLocaleString()}
              </p>
            </div>
            {bestPrice && (
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs text-gray-500">{bestPrice.rating.toFixed(1)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{bestPrice.platform}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
