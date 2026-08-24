export interface PlatformPrice {
  platform: string;
  price: number;
  originalPrice: number;
  url: string;
  inStock: boolean;
  shipping: number;
  rating: number;
  reviews: number;
}

export interface Product {
  _id: string;
  name: string;
  nameTh: string;
  brand: string;
  category: string;
  image: string;
  images: string[];
  description: string;
  prices: PlatformPrice[];
  minPrice: number;
  maxPrice: number;
  tags: string[];
  featured: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
}

export interface Alert {
  _id: string;
  product: Product;
  targetPrice: number;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type Category = "smartphone" | "laptop" | "tablet" | "audio" | "home" | "fashion";

export const PLATFORM_COLORS: Record<string, string> = {
  "Shopee":       "#F97316",
  "Lazada":       "#7C3AED",
  "JD Central":   "#EF4444",
  "Apple Store":  "#1D4ED8",
  "Samsung Shop": "#1D4ED8",
  "Power Buy":    "#059669",
  "Banana IT":    "#CA8A04",
  "Central Online": "#BE123C",
  "Sony Store":   "#1E293B",
  "Dyson Store":  "#6B21A8",
  "Nike.com":     "#111827",
};
