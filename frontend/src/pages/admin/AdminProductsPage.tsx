import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, scraperApi } from "../../api";
import { proxyImage } from "../../utils/imageUrl";
import { Trash2, Plus, TrendingDown, RefreshCw, Zap, Clock, X, Pencil, Star, Search, Eye, EyeOff } from "lucide-react";
import { Product } from "../../types";

interface ProductForm {
  nameTh: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  description: string;
  featured: boolean;
  searchKeyword: string;
}

const EMPTY_FORM: ProductForm = {
  nameTh: "", name: "", brand: "", category: "smartphone",
  image: "", description: "", featured: false, searchKeyword: "",
};

const DEFAULT_CATEGORIES = [
  { value: "smartphone", label: "📱 สมาร์ทโฟน" },
  { value: "laptop",     label: "💻 โน้ตบุ๊ค"  },
  { value: "tablet",     label: "📟 แท็บเล็ต"  },
  { value: "audio",      label: "🎧 เสียง"      },
  { value: "home",       label: "🏠 ในบ้าน"     },
  { value: "fashion",    label: "👟 แฟชั่น"     },
  { value: "beauty",     label: "💄 ความงาม"    },
  { value: "health",     label: "💊 สุขภาพ"     },
];

/** Platforms added by default per product category */
const CATEGORY_DEFAULT_PLATFORMS: Record<string, string[]> = {
  beauty:  ["Lazada", "Watsons"],
  health:  ["Lazada", "Watsons"],
};

const ALL_FILTER = "all";

type ModalMode = "add" | "edit";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [addingStatus, setAddingStatus] = useState<"idle" | "saving" | "scraping" | "done">("idle");
  const [filterCategory, setFilterCategory] = useState<string>(ALL_FILTER);
  const [searchText, setSearchText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => adminApi.getProducts(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminApi.getCategories(),
  });

  const CATEGORIES: { value: string; label: string }[] = useMemo(() => {
    const dbCats = categoriesData?.data ?? [];
    if (dbCats.length === 0) return DEFAULT_CATEGORIES;
    return dbCats.map((c: any) => ({ value: c.name, label: `${c.emoji} ${c.label}` }));
  }, [categoriesData]);

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => adminApi.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      closeModal();
    },
    onError: () => setFormError("บันทึกไม่สำเร็จ กรุณาลองใหม่"),
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      adminApi.updateProduct(id, { featured }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const hiddenMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleHidden(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const scrapeOne = async (productId: string) => {
    setScrapingId(productId);
    try {
      await scraperApi.updateOne(productId);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        setScrapingId(null);
      }, 20_000);
    } catch { setScrapingId(null); }
  };

  const openAdd = () => {
    setModalMode("add");
    setForm(EMPTY_FORM);
    setFormError("");
    setAddingStatus("idle");
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setModalMode("edit");
    setForm({
      nameTh: p.nameTh,
      name: p.name,
      brand: p.brand,
      category: p.category,
      image: p.image,
      description: p.description || "",
      featured: p.featured,
      searchKeyword: (p as any).searchKeyword || "",
    });
    setFormError("");
    setAddingStatus("idle");
    setEditingId(p._id);
    setShowModal(true);
  };

  const closeModal = () => {
    if (addingStatus === "saving" || addingStatus === "scraping") return;
    setShowModal(false);
    setForm(EMPTY_FORM);
    setFormError("");
    setAddingStatus("idle");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.nameTh.trim() || !form.name.trim() || !form.brand.trim()) {
      setFormError("กรุณากรอก ชื่อไทย, ชื่ออังกฤษ และ แบรนด์");
      return;
    }

    if (modalMode === "edit" && editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          nameTh: form.nameTh.trim(),
          name: form.name.trim(),
          brand: form.brand.trim(),
          category: form.category,
          image: form.image.trim() || "",
          description: form.description.trim(),
          featured: form.featured,
          searchKeyword: form.searchKeyword.trim() || undefined,
        },
      });
      return;
    }

    // Add mode
    setAddingStatus("saving");
    const payload = {
      name: form.name.trim(),
      nameTh: form.nameTh.trim(),
      brand: form.brand.trim(),
      category: form.category,
      image: form.image.trim() || "",
      description: form.description.trim(),
      featured: form.featured,
      searchKeyword: form.searchKeyword.trim() || undefined,
      tags: [form.brand.toLowerCase(), ...form.name.toLowerCase().split(" ").slice(0, 3)],
      prices: (CATEGORY_DEFAULT_PLATFORMS[form.category] ?? ["Lazada"]).map((platform) => ({
        platform,
        price: 0, originalPrice: 0,
        url: platform === "Watsons"
          ? "https://www.watsons.co.th/"
          : "https://www.lazada.co.th/",
        inStock: true, shipping: 0, rating: 0, reviews: 0,
      })),
      minPrice: 0, maxPrice: 0,
    };
    try {
      const res = await adminApi.createProduct(payload);
      const newId: string = res.data._id;
      setAddingStatus("scraping");
      await scraperApi.updateOne(newId);
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        setAddingStatus("done");
        setTimeout(() => { setShowModal(false); setForm(EMPTY_FORM); setAddingStatus("idle"); }, 1_500);
      }, 18_000);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setAddingStatus("idle");
    }
  };

  const allProducts: Product[] = data?.data ?? [];

  // Count per category for badge display
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts.forEach((p) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });
    return counts;
  }, [allProducts]);

  // Filtered products by category + search
  const products = useMemo(() => {
    let list = allProducts;
    if (filterCategory !== ALL_FILTER) {
      list = list.filter((p) => p.category === filterCategory);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.nameTh?.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allProducts, filterCategory, searchText]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สินค้า</h1>
          <p className="text-gray-500 text-sm">
            จัดการสินค้าทั้งหมด ({allProducts.length} รายการ
            {(filterCategory !== ALL_FILTER || searchText) && (
              <span className="text-blue-500"> · แสดง {products.length}</span>
            )}
            )
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> เพิ่มสินค้า
        </button>
      </div>

      {/* ── Category filter + search bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <button
            onClick={() => setFilterCategory(ALL_FILTER)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              filterCategory === ALL_FILTER
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            ทั้งหมด
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              filterCategory === ALL_FILTER ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {allProducts.length}
            </span>
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.value] ?? 0;
            const active = filterCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(active ? ALL_FILTER : cat.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {cat.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-56 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="ค้นหาชื่อ / แบรนด์..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Scraping status banner */}
      {scrapingId && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 text-green-700 text-sm">
          <RefreshCw size={15} className="animate-spin shrink-0" />
          <div>
            <p className="font-semibold">กำลังดึงราคาจากทุกแพลตฟอร์ม...</p>
            <p className="text-green-600 text-xs">ราคาจะอัปเดตใน 15–30 วินาที</p>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> กำลังโหลด...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {allProducts.length === 0 ? (
              <p>ยังไม่มีสินค้า — ลอง Seed ข้อมูลตัวอย่างจากหน้าภาพรวม</p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-500 font-medium">ไม่พบสินค้าที่ค้นหา</p>
                <p className="text-xs">
                  {searchText && filterCategory !== ALL_FILTER
                    ? `ไม่มีสินค้าในหมวด "${CATEGORIES.find(c => c.value === filterCategory)?.label}" ที่ตรงกับ "${searchText}"`
                    : searchText
                    ? `ไม่มีสินค้าที่ตรงกับ "${searchText}"`
                    : `ไม่มีสินค้าในหมวด "${CATEGORIES.find(c => c.value === filterCategory)?.label}"`
                  }
                </p>
                <button
                  onClick={() => { setFilterCategory(ALL_FILTER); setSearchText(""); }}
                  className="text-blue-500 text-xs hover:underline mt-1"
                >
                  ล้างตัวกรอง
                </button>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">สินค้า</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">หมวดหมู่</th>
                <th className="text-center px-4 py-3 font-medium">ร้านค้า</th>
                <th className="text-right px-4 py-3 font-medium">ราคาต่ำสุด</th>
                <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">อัพเดทล่าสุด</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => {
                const availableCount = p.prices.filter((pr: any) => pr.available !== false).length;
                const totalCount = p.prices.length;
                return (
                  <tr key={p._id} className={`hover:bg-gray-50 transition-colors group ${(p as any).hidden ? "opacity-50" : ""}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={proxyImage(p.image)} alt={p.nameTh}
                          className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 p-0.5 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-900 line-clamp-1">{p.nameTh}</p>
                            {p.featured && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                            {(p as any).hidden && (
                              <span className="badge bg-gray-100 text-gray-400 text-[10px] flex items-center gap-0.5">
                                <EyeOff size={9} /> ซ่อน
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-gray-600">
                        <TrendingDown size={13} className="text-blue-400" />
                        <span className="font-medium">{availableCount}</span>
                        <span className="text-gray-300 text-xs">/{totalCount}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">
                      {p.minPrice > 0 ? `฿${p.minPrice.toLocaleString()}`
                        : <span className="text-gray-300 font-normal text-xs">ยังไม่มีราคา</span>}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {p.lastScraped ? (
                        <span className="flex items-center justify-center gap-1 text-xs text-gray-400">
                          <Clock size={11} />
                          {new Date(p.lastScraped).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      ) : <span className="text-xs text-gray-300">ยังไม่เคย</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Hide/Show toggle */}
                        <button
                          onClick={() => hiddenMutation.mutate(p._id)}
                          title={(p as any).hidden ? "แสดงสินค้า" : "ซ่อนสินค้า"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            (p as any).hidden ? "text-gray-400 hover:text-blue-500" : "text-gray-300 hover:text-gray-500"
                          }`}
                        >
                          {(p as any).hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        {/* Featured toggle */}
                        <button
                          onClick={() => featuredMutation.mutate({ id: p._id, featured: !p.featured })}
                          title={p.featured ? "ยกเลิก Featured" : "ตั้งเป็น Featured"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            p.featured ? "text-amber-400 hover:text-amber-600" : "text-gray-300 hover:text-amber-400"
                          }`}
                        >
                          <Star size={14} className={p.featured ? "fill-amber-400" : ""} />
                        </button>
                        {/* Scrape */}
                        <button
                          onClick={() => scrapeOne(p._id)}
                          disabled={scrapingId !== null}
                          title="ดึงราคาล่าสุด"
                          className="text-gray-300 hover:text-green-500 p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed"
                        >
                          {scrapingId === p._id
                            ? <RefreshCw size={14} className="animate-spin text-green-500" />
                            : <Zap size={14} />}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(p)}
                          title="แก้ไข"
                          className="text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirm(`ลบสินค้า "${p.nameTh}" ?`)) deleteMutation.mutate(p._id);
                          }}
                          className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {modalMode === "edit" ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
              </h2>
              <button onClick={closeModal} disabled={addingStatus === "saving" || addingStatus === "scraping"}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อภาษาไทย <span className="text-red-500">*</span></label>
                  <input value={form.nameTh} onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
                    placeholder="เช่น ซัมซุง กาแล็กซี่ เอส26" className="input w-full text-sm"
                    disabled={addingStatus !== "idle"} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อภาษาอังกฤษ <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น Samsung Galaxy S26 256GB" className="input w-full text-sm"
                    disabled={addingStatus !== "idle"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">แบรนด์ <span className="text-red-500">*</span></label>
                  <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Samsung" className="input w-full text-sm" disabled={addingStatus !== "idle"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">หมวดหมู่</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input w-full text-sm" disabled={addingStatus !== "idle"}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Search Keyword <span className="text-gray-400 font-normal">(ไม่บังคับ — override คำค้นหา scraper)</span>
                  </label>
                  <input value={form.searchKeyword} onChange={(e) => setForm({ ...form, searchKeyword: e.target.value })}
                    placeholder="เช่น Samsung S26" className="input w-full text-sm" disabled={addingStatus !== "idle"} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    URL รูปภาพ
                    <span className="ml-1.5 text-[10px] font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      🖼 auto-fill จาก scraper
                    </span>
                  </label>
                  <input type="url" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })}
                    placeholder="ปล่อยว่างได้ — ระบบจะดึงรูปอัตโนมัติตอน scrape"
                    className="input w-full text-sm" disabled={addingStatus !== "idle"} />
                  <p className="text-xs text-gray-400 mt-1">
                    ถ้าไม่ใส่ รูปจะถูกดึงจาก Lazada / JIB / Central อัตโนมัติหลัง scrape ครั้งแรก
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">รายละเอียด</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} placeholder="สเปคสินค้าโดยย่อ..."
                    className="input w-full text-sm resize-none" disabled={addingStatus !== "idle"} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      onClick={() => addingStatus === "idle" && setForm({ ...form, featured: !form.featured })}
                      className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.featured ? "bg-amber-400" : "bg-gray-200"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.featured ? "left-5" : "left-1"}`} />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">สินค้าแนะนำ (Featured)</span>
                      <p className="text-xs text-gray-400">แสดงในส่วน "สินค้าแนะนำ" หน้าหลัก</p>
                    </div>
                  </label>
                </div>
              </div>

              {formError && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{formError}</p>}

              {addingStatus === "saving" && (
                <div className="flex items-center gap-2 text-blue-600 text-sm bg-blue-50 rounded-lg px-3 py-2">
                  <RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...
                </div>
              )}
              {addingStatus === "scraping" && (
                <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">
                  <RefreshCw size={14} className="animate-spin shrink-0" />
                  <div><p className="font-semibold">กำลังดึงราคา...</p><p className="text-xs text-green-600">ใช้เวลา 15–20 วินาที</p></div>
                </div>
              )}
              {addingStatus === "done" && (
                <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">
                  <span>✅</span> เพิ่มสินค้าและดึงราคาสำเร็จ!
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  disabled={addingStatus === "saving" || addingStatus === "scraping"}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all">
                  ยกเลิก
                </button>
                <button type="submit"
                  disabled={addingStatus !== "idle" || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  {updateMutation.isPending || addingStatus !== "idle"
                    ? <><RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...</>
                    : modalMode === "edit" ? "บันทึกการแก้ไข" : <><Plus size={15} /> เพิ่มและดึงราคา</>
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
