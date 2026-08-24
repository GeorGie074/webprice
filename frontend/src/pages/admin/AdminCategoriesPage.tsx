import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { Plus, Trash2, Package, RefreshCw, X } from "lucide-react";

interface CategoryItem {
  _id: string;
  name: string;
  label: string;
  emoji: string;
  isDefault: boolean;
  productCount: number;
}

interface AddForm {
  name: string;
  label: string;
  emoji: string;
}

const EMPTY_FORM: AddForm = { name: "", label: "", emoji: "📦" };

const EMOJI_OPTIONS = [
  "📦","📱","💻","🖥","🎧","🎮","📷","🎬","🏠","🛋","👗","👟","⌚",
  "🚗","🏋","🎵","📚","🧸","🍕","💄","💊","✈","🌱","🔌","🖨",
];

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminApi.getCategories(),
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setFormError("");
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || "เกิดข้อผิดพลาด");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
    onError: (err: any) => {
      alert(err?.response?.data?.message || "ลบไม่สำเร็จ");
    },
  });

  const categories: CategoryItem[] = data?.data ?? [];
  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.label.trim()) {
      setFormError("กรุณากรอก ชื่อ (name) และ ชื่อแสดง (label)");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(form.name.trim())) {
      setFormError("name ต้องใช้เฉพาะตัวพิมพ์เล็ก ตัวเลข - _ เท่านั้น");
      return;
    }
    createMutation.mutate({ name: form.name.trim(), label: form.label.trim(), emoji: form.emoji });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการหมวดหมู่</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {categories.length} หมวดหมู่ · {totalProducts} สินค้าทั้งหมด
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setFormError(""); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> เพิ่มหมวดหมู่
        </button>
      </div>

      {/* Category cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-12 w-12 bg-gray-100 rounded-2xl" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat._id}
              className="card p-5 group hover:shadow-md transition-shadow relative"
            >
              {/* Default badge */}
              {cat.isDefault && (
                <span className="absolute top-3 right-3 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">
                  ค่าเริ่มต้น
                </span>
              )}

              {/* Delete button (non-default only) */}
              {!cat.isDefault && (
                <button
                  onClick={() => {
                    if (cat.productCount > 0) {
                      alert(`ไม่สามารถลบได้ — มีสินค้า ${cat.productCount} รายการในหมวดนี้`);
                      return;
                    }
                    if (confirm(`ลบหมวดหมู่ "${cat.label}" ?`)) {
                      deleteMutation.mutate(cat.name);
                    }
                  }}
                  className="absolute top-3 right-3 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Emoji */}
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl mb-3 border border-gray-100">
                {cat.emoji}
              </div>

              {/* Info */}
              <p className="font-semibold text-gray-900 text-sm">{cat.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{cat.name}</p>

              {/* Product count */}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                <Package size={12} className="text-blue-400" />
                <span className="font-medium text-gray-700">{cat.productCount}</span>
                <span>สินค้า</span>
              </div>

              {/* Bar indicator */}
              {totalProducts > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.max(3, (cat.productCount / totalProducts) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help note */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        <strong className="text-gray-600">หมายเหตุ:</strong> หมวดหมู่ค่าเริ่มต้น 6 รายการไม่สามารถลบได้
        · หมวดหมู่ที่สร้างใหม่จะปรากฏในหน้าเพิ่ม/แก้ไขสินค้าทันที
        · ลบได้เฉพาะหมวดหมู่ที่ไม่มีสินค้าเท่านั้น
      </div>

      {/* ── Add Category Modal ─────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">เพิ่มหมวดหมู่ใหม่</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Emoji picker */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">ไอคอน (Emoji)</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, emoji: e })}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border ${
                        form.emoji === e
                          ? "bg-blue-100 border-blue-400 scale-110"
                          : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  placeholder="หรือพิมพ์ emoji เอง"
                  className="input w-full text-sm mt-2"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal"> (ภาษาอังกฤษ, lowercase เท่านั้น)</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })}
                  placeholder="เช่น gaming"
                  className="input w-full text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ชื่อแสดง (Label) <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="เช่น เกมมิ่ง"
                  className="input w-full text-sm"
                />
              </div>

              {formError && (
                <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {createMutation.isPending
                    ? <><RefreshCw size={14} className="animate-spin" /> บันทึก...</>
                    : <><Plus size={15} /> เพิ่มหมวดหมู่</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
