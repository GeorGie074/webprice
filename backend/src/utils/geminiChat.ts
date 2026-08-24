/**
 * geminiChat.ts — AI assistant for conversational product search.
 *
 * Two-step process:
 *  1. Extract structured filters from user message (fast, cheap)
 *  2. Format a Thai recommendation response using real DB products
 *
 * Uses gemini-2.5-flash (same key as Visual Search — no extra cost).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatFilters {
  category?: string;        // "smartphone" | "laptop" | "tablet" | "audio" | "home" | "fashion" | "beauty" | "health"
  maxPrice?: number;        // THB
  minPrice?: number;        // THB
  brands?: string[];        // ["Apple", "Samsung"]
  keywords?: string[];      // free-text keywords for $regex search
  compareMode?: boolean;    // user wants side-by-side comparison
  sortBy?: "price" | "rating" | "reviews";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Step 1: Extract filters ───────────────────────────────────────────────────

const FILTER_PROMPT = `You are a filter extractor for a Thai e-commerce price comparison website.

Extract search filters from the user's message and return ONLY valid JSON.

Output format:
{
  "category": "smartphone|laptop|tablet|audio|home|fashion|beauty|health|null",
  "maxPrice": number_or_null,
  "minPrice": number_or_null,
  "brands": ["brand names in English"] or [],
  "keywords": ["short English keywords for product search"] or [],
  "compareMode": true_if_user_wants_comparison,
  "sortBy": "price|rating|reviews|null"
}

Examples:
- "โทรศัพท์ไม่เกิน 15000 กล้องดี" → {"category":"smartphone","maxPrice":15000,"keywords":["good camera"],"compareMode":false}
- "เปรียบเทียบ iPhone vs Samsung" → {"category":"smartphone","brands":["Apple","Samsung"],"compareMode":true}
- "หูฟัง Sony ราคาถูกที่สุด" → {"category":"audio","brands":["Sony"],"sortBy":"price"}
- "แล็ปท็อปสำหรับทำงาน งบ 20000-30000" → {"category":"laptop","minPrice":20000,"maxPrice":30000,"keywords":["work","office"]}

Rules:
- ราคา/งบ/ไม่เกิน/บาท → extract as maxPrice
- ถูกที่สุด/ราคาต่ำสุด → sortBy: "price"
- ดีที่สุด/รีวิวดี → sortBy: "rating"
- Return ONLY the JSON object, nothing else`;

export async function extractFilters(
  userMessage: string,
  history: ChatMessage[]
): Promise<ChatFilters> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Include last 2 exchanges for context (e.g. "ถูกกว่านี้หน่อย" needs to know what was searched)
  const context = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = context
    ? `${FILTER_PROMPT}\n\nConversation context:\n${context}\n\nNow extract filters for: "${userMessage}"`
    : `${FILTER_PROMPT}\n\nUser message: "${userMessage}"`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]) as ChatFilters;
  } catch {
    return {};
  }
}

// ── Step 2: Generate Thai response with real products ─────────────────────────

const ASSISTANT_SYSTEM = `คุณคือ AI assistant สำหรับเปรียบราคาสินค้าในเว็บไซต์ PriceCompare ซึ่งเปรียบราคาจากหลายแพลตฟอร์ม (Lazada, Shopee, JIB, Power Buy ฯลฯ)

บทบาทของคุณ:
- แนะนำสินค้าที่เหมาะสมจากข้อมูลจริงที่มีในระบบ
- เปรียบเทียบราคาและคุณสมบัติอย่างตรงไปตรงมา
- ตอบเป็นภาษาไทย กระชับ เป็นมิตร
- ถ้าไม่มีสินค้าที่ตรงกัน บอกตรงๆ และแนะนำทางเลือก

กฎ:
- ห้ามสร้างราคาหรือสินค้าขึ้นมาเอง ใช้เฉพาะข้อมูลที่ให้มา
- ถ้าสินค้าน้อยกว่า 3 ชิ้น บอกว่ามีแค่นี้ในระบบ
- ระบุราคาและแพลตฟอร์มที่ถูกสุดเสมอ
- ตอบไม่เกิน 3-4 ประโยคต่อสินค้า`;

interface ProductSummary {
  name: string;
  brand: string;
  minPrice: number;
  platform: string;
  rating: number;
  category: string;
}

export async function generateResponse(
  userMessage: string,
  history: ChatMessage[],
  products: ProductSummary[],
  filters: ChatFilters
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const productContext =
    products.length > 0
      ? `สินค้าที่พบในระบบ (${products.length} รายการ):\n` +
        products
          .slice(0, 6) // max 6 products to keep context small
          .map(
            (p, i) =>
              `${i + 1}. ${p.brand} ${p.name} — ราคาต่ำสุด ฿${p.minPrice.toLocaleString()} (${p.platform}) ★${p.rating.toFixed(1)}`
          )
          .join("\n")
      : "ไม่พบสินค้าที่ตรงกับเงื่อนไขในระบบ";

  const historyText = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "ผู้ใช้" : "Assistant"}: ${m.content}`)
    .join("\n");

  const filtersText = Object.entries(filters)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");

  const prompt = `${ASSISTANT_SYSTEM}

${historyText ? `ประวัติการสนทนา:\n${historyText}\n` : ""}
ข้อมูลสินค้าจากระบบ:
${productContext}

เงื่อนไขที่ค้นหา: ${filtersText || "ทั่วไป"}

ผู้ใช้ถามว่า: "${userMessage}"

ตอบกลับเป็นภาษาไทย:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("[GeminiChat] Response error:", (err as Error).message);
    return "ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
  }
}
