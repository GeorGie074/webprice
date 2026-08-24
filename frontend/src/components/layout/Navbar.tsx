import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Search, User, Bell, LogOut, ChevronDown, Shield,
  ChevronRight, Camera, Flame, Clock, X, TrendingUp, Telescope,
} from "lucide-react";
import { LogoMark } from "../ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { alertsApi, productsApi } from "../../api";
import { Alert, Product, COMING_SOON_PLATFORMS } from "../../types";
import { useDebounce } from "../../hooks/useDebounce";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
} from "../../hooks/useRecentSearches";
import { proxyImage } from "../../utils/imageUrl";

// ── Trending keywords (static) ─────────────────────────────────────────────────
const TRENDING = ["iPhone 17", "Samsung S26", "MacBook Air", "Sony XM6", "AirPods Pro", "Redmi Note 14"];

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate       = useNavigate();
  const { pathname }   = useLocation();
  const [query,     setQuery]     = useState("");
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [showSugg,  setShowSugg]  = useState(false);
  const [recents,   setRecents]   = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 250);
  const navSearchRef   = useRef<HTMLDivElement>(null);

  // Sync recents from localStorage whenever dropdown opens
  useEffect(() => {
    if (showSugg) setRecents(getRecentSearches());
  }, [showSugg]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (navSearchRef.current && !navSearchRef.current.contains(e.target as Node))
        setShowSugg(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Live product suggestions (only when ≥2 chars)
  const { data: navSuggData, isFetching: loadingNavSugg } = useQuery({
    queryKey: ["navbar-suggest", debouncedQuery],
    queryFn:  () => productsApi.list({ q: debouncedQuery }),
    enabled:  debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const navSuggestions: Product[] = navSuggData?.data?.products?.slice(0, 5) ?? [];

  // Alert count
  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const triggeredCount = ((alertsData?.data as Alert[]) ?? []).filter((a) => a.triggered).length;

  const doSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    setRecents(getRecentSearches());
    setShowSugg(false);
    setQuery("");
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleRemoveRecent = (q: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeRecentSearch(q);
    setRecents(getRecentSearches());
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearRecentSearches();
    setRecents([]);
  };

  // Decide what the dropdown shows
  const showEmpty   = showSugg && query.trim().length < 2;
  const showResults = showSugg && debouncedQuery.trim().length >= 2;

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-16">

          {/* ── Logo ──────────────────────────────────────────────────── */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <LogoMark size={18} />
            </div>
            <span className="font-bold text-lg hidden sm:block text-gray-900">
              Price<span className="text-blue-600">Compare</span>
            </span>
          </Link>

          {/* ── Search bar ────────────────────────────────────────────── */}
          <div className="flex-1 max-w-xl flex items-center gap-2" ref={navSearchRef}>
            <div className="relative flex-1">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowSugg(true); }}
                    onFocus={() => setShowSugg(true)}
                    placeholder="ค้นหาสินค้า เช่น iPhone, Samsung, Sony..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    autoComplete="off"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => { setQuery(""); setShowSugg(true); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </form>

              {/* ── Dropdown: Recent + Trending (when empty) ────────── */}
              {showEmpty && (recents.length > 0 || TRENDING.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[60] text-left">

                  {/* Recent Searches */}
                  {recents.length > 0 && (
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Clock size={10} /> ค้นหาล่าสุด
                        </span>
                        <button
                          onClick={handleClearAll}
                          className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                        >
                          ล้างทั้งหมด
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {recents.map((r) => (
                          <div
                            key={r}
                            onClick={() => doSearch(r)}
                            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
                          >
                            <Clock size={13} className="text-gray-300 shrink-0" />
                            <span className="text-sm text-gray-700 flex-1">{r}</span>
                            <button
                              onClick={(e) => handleRemoveRecent(r, e)}
                              className="text-gray-200 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  {recents.length > 0 && <div className="border-t border-gray-50 mx-4" />}

                  {/* Trending */}
                  <div className="px-4 pt-2.5 pb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <TrendingUp size={10} /> กำลังฮิต
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {TRENDING.map((kw) => (
                        <button
                          key={kw}
                          onClick={() => doSearch(kw)}
                          className="text-xs px-2.5 py-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg text-gray-600 transition-all font-medium"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Dropdown: Live Product Suggestions (when typing) ─ */}
              {showResults && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[60] text-left">
                  {loadingNavSugg ? (
                    <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      กำลังค้นหา...
                    </div>
                  ) : navSuggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">ไม่พบสินค้าที่ตรงกัน</div>
                  ) : (
                    <>
                      <div className="px-4 pt-2 pb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Search size={10} /> ผลการค้นหา
                        </p>
                      </div>
                      {navSuggestions.map((p) => {
                        const active = p.prices.filter(
                          (pr) => pr.available !== false && !COMING_SOON_PLATFORMS.includes(pr.platform)
                        );
                        const minPrice = active.length > 0
                          ? Math.min(...active.map((pr) => pr.price))
                          : p.minPrice;
                        return (
                          <Link
                            key={p._id}
                            to={`/product/${p._id}`}
                            onClick={() => { addRecentSearch(query.trim()); setShowSugg(false); setQuery(""); }}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <img
                              src={proxyImage(p.image)}
                              alt={p.nameTh}
                              className="w-9 h-9 object-contain rounded-lg shrink-0 bg-gray-50"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; (e.target as HTMLImageElement).onerror = null; }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{p.nameTh}</p>
                              <p className="text-xs text-gray-400">{p.brand}</p>
                            </div>
                            <p className="text-sm font-bold text-blue-600 shrink-0">฿{minPrice.toLocaleString()}</p>
                          </Link>
                        );
                      })}
                      <button
                        onClick={() => { doSearch(query); }}
                        className="w-full px-4 py-2.5 text-sm text-blue-600 font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 border-t border-gray-50"
                      >
                        ดูผลการค้นหาทั้งหมดสำหรับ "{query}" <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Camera / Visual Search */}
            <Link
              to="/visual-search"
              title="ค้นหาด้วยรูปภาพ"
              className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all
                ${pathname === "/visual-search"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
                  : "bg-gray-100 text-gray-400 hover:bg-purple-100 hover:text-purple-600"
                }`}
            >
              <Camera size={16} />
            </Link>
          </div>

          {/* ── Quick links (desktop only) ────────────────────────────── */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            <Link
              to="/search?sort=discount"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors border border-orange-100"
            >
              <Flame size={12} /> ดีลวันนี้
            </Link>
            <Link
              to="/search?sort=price_asc"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              📉 ราคาลด
            </Link>
            <Link
              to="/search?featured=true"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ⭐ แนะนำ
            </Link>

            {/* Live Search — members only */}
            {isAuthenticated && (
              <Link
                to="/live-search"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors border border-violet-100"
              >
                <Telescope size={12} /> ค้นหาพิเศษ
              </Link>
            )}
          </div>

          {/* ── Right actions ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2 ml-auto">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-gray-100"
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user?.name[0]?.toUpperCase()}
                    </div>
                    {triggeredCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white">
                        {triggeredCount > 9 ? "9+" : triggeredCount}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium hidden md:block max-w-[100px] truncate text-gray-700">{user?.name}</span>
                  <ChevronDown size={14} className="hidden md:block text-gray-400" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20">
                      <div className="px-4 py-3 border-b border-gray-50">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <User size={15} className="text-gray-400" /> แดชบอร์ด
                        </Link>
                        <Link to="/live-search" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                          <Telescope size={15} className="text-violet-400" />
                          <span className="flex-1">ค้นหาจากแพลตฟอร์ม</span>
                          <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">ใหม่</span>
                        </Link>
                        <Link to="/alerts" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Bell size={15} className="text-gray-400" />
                          <span className="flex-1">การแจ้งเตือนราคา</span>
                          {triggeredCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {triggeredCount}
                            </span>
                          )}
                        </Link>
                        {isAdmin && (
                          <Link to="/admin" onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                            <Shield size={15} className="text-blue-500" /> Admin Panel
                          </Link>
                        )}
                        <button onClick={() => { logout(); setMenuOpen(false); navigate("/"); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <LogOut size={15} className="text-red-400" /> ออกจากระบบ
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-outline !py-2 !px-4 !text-sm">เข้าสู่ระบบ</Link>
                <Link to="/login" className="btn-primary !py-2 !px-4 !text-sm hidden sm:flex">สมัครสมาชิก</Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
