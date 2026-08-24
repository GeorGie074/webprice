import { useCompare } from "../../context/CompareContext";
import { X, GitCompare, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CompareBar() {
  const { items, remove, clear } = useCompare();
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 px-4 pointer-events-none">
      <div
        className="pointer-events-auto bg-white/92 backdrop-blur-xl border border-gray-200/80 rounded-2xl shadow-2xl shadow-gray-900/15 px-5 py-3 flex items-center gap-3 sm:gap-4 max-w-2xl w-full"
        style={{ animation: "compareBarIn 0.28s cubic-bezier(.22,.68,0,1.2)" }}
      >
        {/* Icon + label */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
            <GitCompare size={14} className="text-blue-600" />
          </div>
          <span className="text-sm font-bold text-gray-700 hidden sm:block">เปรียบเทียบ</span>
        </div>

        {/* Product thumbnails + empty slots */}
        <div className="flex gap-2 flex-1">
          {items.map((p) => (
            <div key={p._id} className="relative group shrink-0">
              <img
                src={p.image}
                alt={p.nameTh}
                title={p.nameTh}
                className="w-11 h-11 rounded-xl object-contain bg-gray-50 border border-gray-200 p-1 ring-2 ring-blue-400 ring-offset-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/100?text=?";
                }}
              />
              <button
                onClick={() => remove(p._id)}
                className="absolute -top-2 -right-2 w-[18px] h-[18px] bg-gray-800 hover:bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
              >
                <X size={9} />
              </button>
            </div>
          ))}

          {Array.from({ length: 3 - items.length }).map((_, i) => (
            <div
              key={i}
              className="w-11 h-11 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 shrink-0 text-xl font-light select-none"
            >
              +
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={clear}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            ล้าง
          </button>
          <button
            onClick={() =>
              navigate(`/compare?ids=${items.map((p) => p._id).join(",")}`)
            }
            disabled={items.length < 2}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-500/25"
          >
            เปรียบ {items.length} รายการ
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
