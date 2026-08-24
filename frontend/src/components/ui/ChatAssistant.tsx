import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle, X, Send, Sparkles, Bot,
  ChevronRight, ShoppingBag, Loader2,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { chatApi } from "../../api";
import { Product, COMING_SOON_PLATFORMS } from "../../types";
import { proxyImage } from "../../utils/imageUrl";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  loading?: boolean;
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "โทรศัพท์ไม่เกิน 15,000 กล้องดี",
  "หูฟัง Sony ราคาถูกสุด",
  "แล็ปท็อปสำหรับทำงาน งบ 25,000",
  "สกินแคร์แนะนำงบ 500 บาท",
];

// ── Mini product card inside chat ─────────────────────────────────────────────

function ChatProductCard({ product }: { product: Product }) {
  const activePrices = product.prices.filter(
    (p) => !COMING_SOON_PLATFORMS.includes(p.platform) && p.available !== false
  );
  const minPrice =
    activePrices.length > 0
      ? Math.min(...activePrices.map((p) => p.price))
      : product.minPrice;
  const cheapest = activePrices.find((p) => p.price === minPrice);

  return (
    <Link
      to={`/product/${product._id}`}
      className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      <img
        src={proxyImage(product.image)}
        alt={product.nameTh}
        className="w-10 h-10 object-contain rounded-lg bg-gray-50 shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/placeholder-product.svg";
          (e.target as HTMLImageElement).onerror = null;
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
          {product.nameTh}
        </p>
        <p className="text-xs text-blue-600 font-bold">
          ฿{minPrice.toLocaleString()}
          <span className="text-gray-400 font-normal ml-1">· {cheapest?.platform}</span>
        </p>
      </div>
      <ChevronRight size={12} className="text-gray-300 group-hover:text-blue-400 shrink-0" />
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChatAssistant() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "สวัสดีครับ! ผมช่วยค้นหาและเปรียบราคาสินค้าให้ได้เลย\n\nลองถามได้เช่น \"โทรศัพท์ราคาไม่เกิน 15,000 กล้องดี\" หรือ \"เปรียบเทียบ Sony กับ Samsung\" ครับ 😊",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const mutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: ChatMessage[] }) =>
      chatApi.send(
        message,
        history
          .filter((m) => !m.loading)
          .map((m) => ({ role: m.role, content: m.content }))
      ),
    onSuccess: (res) => {
      const { message: aiMsg, products } = res.data as {
        message: string;
        products: Product[];
      };
      setMessages((prev) => [
        ...prev.filter((m) => !m.loading),
        { role: "assistant", content: aiMsg, products },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev.filter((m) => !m.loading),
        {
          role: "assistant",
          content: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
        },
      ]);
    },
  });

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;

    const history = [...messages];
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const loadingMsg: ChatMessage = {
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    mutation.mutate({ message: trimmed, history });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* ── Floating button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700
          shadow-lg shadow-purple-500/40 flex items-center justify-center text-white
          hover:scale-110 active:scale-95 transition-all duration-200
          ${open ? "opacity-0 pointer-events-none scale-75" : "opacity-100"}`}
        title="AI Shopping Assistant"
      >
        <MessageCircle size={24} />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-2xl ring-2 ring-purple-400 animate-ping opacity-30" />
      </button>

      {/* ── Chat drawer ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-3xl shadow-2xl border border-gray-100
          transition-all duration-300 origin-bottom-right
          ${open
            ? "opacity-100 scale-100 w-[360px] h-[580px]"
            : "opacity-0 scale-75 pointer-events-none w-[360px] h-[580px]"
          }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-violet-600 to-purple-700 rounded-t-3xl">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Bot size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">AI Shopping Assistant</p>
            <p className="text-[10px] text-purple-200 flex items-center gap-1">
              <Sparkles size={9} />
              Powered by Gemini 2.5 Flash
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-white" />
                </div>
              )}

              <div className={`flex flex-col gap-1.5 max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Bubble */}
                {msg.loading ? (
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-100 flex items-center gap-2">
                    <Loader2 size={14} className="text-purple-500 animate-spin" />
                    <span className="text-xs text-gray-500">กำลังค้นหา...</span>
                  </div>
                ) : (
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                      ${msg.role === "user"
                        ? "bg-purple-600 text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-800 rounded-tl-sm"
                      }`}
                  >
                    {msg.content}
                  </div>
                )}

                {/* Product cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="w-full space-y-1.5 mt-0.5">
                    {msg.products.slice(0, 4).map((p) => (
                      <ChatProductCard key={p._id} product={p} />
                    ))}
                    {msg.products.length > 4 && (
                      <p className="text-xs text-gray-400 text-center">
                        +{msg.products.length - 4} สินค้าเพิ่มเติม
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Suggestion chips — show only when no conversation yet */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2.5 py-1 hover:bg-purple-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ถามหาสินค้าหรือเปรียบราคา..."
              disabled={mutation.isPending}
              className="flex-1 text-sm px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200
                focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/10
                disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || mutation.isPending}
              className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center
                hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed
                active:scale-95 transition-all shrink-0"
            >
              {mutation.isPending
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={15} />
              }
            </button>
          </form>
          <p className="text-[10px] text-gray-400 text-center mt-1.5 flex items-center justify-center gap-1">
            <ShoppingBag size={9} />
            ค้นหาราคาจริงจากฐานข้อมูล PriceCompare
          </p>
        </div>
      </div>
    </>
  );
}
