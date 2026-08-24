import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
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
  me: () => api.get("/auth/me"),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: { q?: string; category?: string; featured?: boolean; page?: number }) =>
    api.get("/products", { params }),
  getById: (id: string) => api.get(`/products/${id}`),
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
  stats: () => api.get("/admin/stats"),
  getUsers: () => api.get("/admin/users"),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  setRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
  getProducts: () => api.get("/admin/products"),
  createProduct: (data: unknown) => api.post("/admin/products", data),
  updateProduct: (id: string, data: unknown) => api.put(`/admin/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/admin/products/${id}`),
  seed: () => api.post("/seed"),
};
