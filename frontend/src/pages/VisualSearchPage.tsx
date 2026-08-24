import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, X, Sparkles, Search, AlertCircle, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { visualSearchApi } from "../api";
import { ProductCard } from "../components/ui/ProductCard";
import { Product } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Identification {
  brand: string;
  name: string;
  model: string;
  keywords: string[];
  category: string;
  confidence: "high" | "medium" | "low";
}

interface VisualSearchResult {
  identification: Identification;
  products: Product[];
  searchKeyword: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<string, { text: string; color: string }> = {
  high:   { text: "ระบุได้แน่ชัด",  color: "text-green-600 bg-green-50 border-green-200" },
  medium: { text: "ระบุได้พอสมควร", color: "text-amber-600 bg-amber-50 border-amber-200" },
  low:    { text: "ไม่แน่ใจมาก",    color: "text-red-600 bg-red-50 border-red-200" },
};

/** Resize image to max 800px and convert to base64 via canvas. */
function resizeAndEncode(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
        else                { width  = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      // Always output JPEG for smaller size
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Cannot load image")); };
    img.src = url;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VisualSearchPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);

  // ── Mutation ────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType: string }) =>
      visualSearchApi.search(base64, mimeType),
  });

  const result: VisualSearchResult | null = mutation.data?.data ?? null;

  // ── File handling ────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    // Resize + encode
    try {
      const encoded = await resizeAndEncode(file);
      setFileData(encoded);
      mutation.reset();
    } catch {
      console.error("Failed to process image");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSearch = () => {
    if (fileData) mutation.mutate(fileData);
  };

  const handleReset = () => {
    setPreview(null);
    setFileData(null);
    mutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const confidenceBadge = result
    ? CONFIDENCE_LABEL[result.identification.confidence]
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/30 mb-4">
          <Camera size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Visual Search</h1>
        <p className="text-gray-500 text-sm">
          อัปโหลดรูปสินค้า — AI จะระบุสินค้าและค้นหาราคาจากทุกแพลตฟอร์มให้อัตโนมัติ
        </p>
        <p className="text-xs text-purple-500 mt-1 flex items-center justify-center gap-1">
          <Sparkles size={11} />
          Powered by Google Gemini Flash (Free)
        </p>
      </div>

      {/* ── Upload zone ─────────────────────────────────────────────────────── */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-200
            ${dragOver
              ? "border-purple-400 bg-purple-50 scale-[1.01]"
              : "border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-50/50"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
              ${dragOver ? "bg-purple-100" : "bg-white shadow-sm border border-gray-100"}`}>
              <Upload size={28} className={dragOver ? "text-purple-500" : "text-gray-400"} />
            </div>
            <div>
              <p className="font-semibold text-gray-700">
                {dragOver ? "ปล่อยรูปได้เลย!" : "ลากรูปมาวางที่นี่ หรือคลิกเพื่อเลือก"}
              </p>
              <p className="text-sm text-gray-400 mt-1">รองรับ JPG, PNG, WEBP — ขนาดไม่เกิน 10 MB</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2 text-xs text-gray-400">
              {["📱 รูปโทรศัพท์", "💻 ภาพหน้าจอ", "🎧 รูปอุปกรณ์", "👟 สินค้า Fashion"].map((ex) => (
                <span key={ex} className="px-2.5 py-1 bg-white rounded-full border border-gray-100">{ex}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ── Preview + action ───────────────────────────────────────────────────
        <div className="flex flex-col items-center gap-5">
          <div className="relative inline-block">
            <img
              src={preview}
              alt="preview"
              className="max-h-80 max-w-full rounded-2xl shadow-lg object-contain"
            />
            <button
              onClick={handleReset}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {!mutation.isPending && !mutation.isSuccess && !mutation.isError && (
            <button
              onClick={handleSearch}
              className="btn-primary flex items-center gap-2 !px-8 !py-3 text-base"
            >
              <Search size={18} />
              ค้นหาราคาจากรูปนี้
            </button>
          )}

          {mutation.isPending && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
              <p className="text-sm font-medium text-gray-600">Gemini กำลังวิเคราะห์รูปภาพ...</p>
              <p className="text-xs text-gray-400">อาจใช้เวลา 2–5 วินาที</p>
            </div>
          )}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {mutation.isError && (
        <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">ระบุสินค้าไม่ได้</p>
            <p className="text-xs text-red-500 mt-0.5">
              {(mutation.error as any)?.response?.data?.error ??
                "ไม่สามารถเชื่อมต่อกับ Gemini ได้ กรุณาตรวจสอบ API key"}
            </p>
          </div>
          <button onClick={handleReset} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
            <RefreshCw size={15} />
          </button>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {result && (
        <div className="mt-8 space-y-6">

          {/* ── Identification card ──────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-purple-100 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              {/* Preview thumb */}
              {preview && (
                <img
                  src={preview}
                  alt="analyzed"
                  className="w-16 h-16 object-contain rounded-xl bg-white border border-purple-100 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-purple-500" />
                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Gemini ระบุสินค้า</span>
                  {confidenceBadge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceBadge.color}`}>
                      {confidenceBadge.text}
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-gray-900 truncate">{result.identification.name}</p>
                <p className="text-sm text-gray-500">{result.identification.brand} · {result.identification.category}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {result.identification.keywords.map((kw) => (
                    <span key={kw} className="text-xs bg-white border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              {/* Re-upload */}
              <button
                onClick={handleReset}
                className="shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 transition-colors border border-gray-100 hover:border-purple-200 rounded-xl px-2.5 py-1.5 bg-white"
              >
                <RefreshCw size={12} />
                ลองใหม่
              </button>
            </div>
          </div>

          {/* ── Product grid ─────────────────────────────────────────────────── */}
          {result.products.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">
                  พบ {result.products.length} รายการ ในฐานข้อมูล
                </h2>
                <button
                  onClick={() => navigate(`/search?q=${encodeURIComponent(result.searchKeyword)}`)}
                  className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Search size={13} />
                  ค้นหาเพิ่มเติม
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {result.products.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </>
          ) : (
            // ── Not found in DB ────────────────────────────────────────────────
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-semibold text-gray-700">ยังไม่มีสินค้านี้ในฐานข้อมูล</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">
                ลองค้นหาด้วยคำว่า <span className="font-semibold text-gray-600">"{result.searchKeyword}"</span>
              </p>
              <button
                onClick={() => navigate(`/search?q=${encodeURIComponent(result.searchKeyword)}`)}
                className="btn-primary !py-2 !px-6 text-sm"
              >
                <Search size={14} className="inline mr-1.5" />
                ค้นหาสินค้า
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
