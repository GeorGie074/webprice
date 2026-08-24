import axios from "axios";

const api = axios.create({
  // Dev → localhost:5000  |  Production → ค่าจาก VITE_API_URL
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post("/auth/register", { name, email, password }),
  googleLogin: (credential: string) =>
    api.post("/auth/google", { credential }),
  me: () => api.get("/auth/me"),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: { q?: string; category?: string; featured?: boolean; page?: number }) =>
    api.get("/products", { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  getHistory: (id: string, days = 30) => api.get(`/products/${id}/history`, { params: { days } }),
  getInsights: (id: string) => api.get(`/products/${id}/insights`),
  getRelated:  (id: string) => api.get(`/products/${id}/related`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: () => api.get("/alerts"),
  create: (productId: string, targetPrice: number) =>
    api.post("/alerts", { productId, targetPrice }),
  delete: (id: string) => api.delete(`/alerts/${id}`),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  stats:     () => api.get("/admin/stats"),
  analytics: () => api.get("/admin/analytics"),

  // Users
  getUsers: () => api.get("/admin/users"),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  setRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
  suspendUser: (id: string) => api.patch(`/admin/users/${id}/suspend`),
  getUserBehavior: (id: string) => api.get(`/admin/users/${id}/behavior`),

  // Products
  getProducts: () => api.get("/admin/products"),
  createProduct: (data: unknown) => api.post("/admin/products", data),
  updateProduct: (id: string, data: unknown) => api.put(`/admin/products/${id}`, data),
  toggleHidden: (id: string) => api.patch(`/admin/products/${id}/hidden`),
  deleteProduct: (id: string) => api.delete(`/admin/products/${id}`),

  // Alerts
  getAlerts: () => api.get("/admin/alerts"),

  // Scraper
  getScraperStatus: () => api.get("/admin/scraper/status"),

  // Categories
  getCategories: () => api.get("/admin/categories"),
  createCategory: (data: { name: string; label: string; emoji: string }) =>
    api.post("/admin/categories", data),
  deleteCategory: (name: string) => api.delete(`/admin/categories/${name}`),

  seed: () => api.post("/seed"),
};

// ─── Live Search ──────────────────────────────────────────────────────────────
export const liveSearchApi = {
  search: (query: string, platform: string, limit = 20) =>
    api.post("/live-search", { query, platform, limit }),
};

// ─── Scraper ──────────────────────────────────────────────────────────────────
export const scraperApi = {
  updateAll:   () => api.post("/scraper/update"),
  updateOne:   (productId: string) => api.post(`/scraper/update/${productId}`),
  getProgress: () => api.get("/scraper/progress"),
};

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export const wishlistApi = {
  list:         ()             => api.get("/wishlist"),
  add:          (id: string)   => api.post(`/wishlist/${id}`),
  remove:       (id: string)   => api.delete(`/wishlist/${id}`),
  setLineToken: (token: string)=> api.put("/wishlist/line-token", { token }),
  getLineStatus:()             => api.get("/wishlist/line-token"),
};

// ─── Visual Search ────────────────────────────────────────────────────────────
export const visualSearchApi = {
  search: (image: string, mimeType: string) =>
    api.post("/visual-search", { image, mimeType }),
};

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export const chatApi = {
  send: (message: string, history: { role: string; content: string }[]) =>
    api.post("/chat", { message, history }),
};
