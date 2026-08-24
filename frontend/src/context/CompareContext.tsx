import { createContext, useContext, useState, ReactNode } from "react";
import { Product } from "../types";

const MAX_COMPARE = 3;

interface CompareCtx {
  items:      Product[];
  add:        (p: Product) => void;
  remove:     (id: string) => void;
  clear:      () => void;
  isSelected: (id: string) => boolean;
  isFull:     boolean;
}

const CompareContext = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Product[]>([]);

  const add = (p: Product) => {
    if (items.length >= MAX_COMPARE || items.find((x) => x._id === p._id)) return;
    setItems((prev) => [...prev, p]);
  };

  const remove = (id: string) => setItems((prev) => prev.filter((p) => p._id !== id));
  const clear  = ()            => setItems([]);
  const isSelected = (id: string) => items.some((p) => p._id === id);

  return (
    <CompareContext.Provider value={{ items, add, remove, clear, isSelected, isFull: items.length >= MAX_COMPARE }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be inside CompareProvider");
  return ctx;
}
