import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

// Layouts
import UserLayout from "./components/layout/UserLayout";
import AdminLayout from "./pages/admin/AdminLayout";

// Guards
import { AdminGuard } from "./guards/AdminGuard";
import { AuthGuard } from "./guards/AuthGuard";

// User pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SearchPage from "./pages/SearchPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import UserDashboardPage from "./pages/UserDashboardPage";

// Admin pages
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";

const router = createBrowserRouter([
  // ─── Auth ──────────────────────────────────────────────────────────────────
  { path: "/login", element: <LoginPage /> },
  { path: "/admin/login", element: <AdminLoginPage /> },

  // ─── User routes ───────────────────────────────────────────────────────────
  {
    path: "/",
    element: <UserLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "search", element: <SearchPage /> },
      { path: "product/:id", element: <ProductDetailPage /> },
      {
        path: "dashboard",
        element: <AuthGuard><UserDashboardPage /></AuthGuard>,
      },
      {
        path: "alerts",
        element: <AuthGuard><UserDashboardPage /></AuthGuard>,
      },
    ],
  },

  // ─── Admin routes ──────────────────────────────────────────────────────────
  {
    path: "/admin",
    element: <AdminGuard><AdminLayout /></AdminGuard>,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "products", element: <AdminProductsPage /> },
      { path: "logs", element: <AdminLogsPage /> },
    ],
  },

  // Fallback
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
