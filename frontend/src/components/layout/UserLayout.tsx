import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import { CompareBar } from "../ui/CompareBar";
import { PriceDropToast } from "../ui/PriceDropToast";
import { ChatAssistant } from "../ui/ChatAssistant";

export default function UserLayout() {
  const { pathname } = useLocation();

  // Scroll to top on every route change so product pages always open at the top,
  // not at the scroll position left over from a previous page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  const isHome = pathname === "/";

  return (
    <div
      className={`min-h-screen ${isHome ? "bg-transparent" : "bg-gray-50"}`}
      style={{ isolation: "isolate" }}
    >
      <Navbar />
      <main>
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-400">
          © 2026 PriceCompare · เปรียบราคา ประหยัดได้จริง
        </div>
      </footer>

      {/* Floating compare bar — rendered on all user pages */}
      <CompareBar />

      {/* Price drop toast — notifies when wishlist items drop in price */}
      <PriceDropToast />

      {/* AI Shopping Assistant — floating chat button */}
      <ChatAssistant />
    </div>
  );
}
