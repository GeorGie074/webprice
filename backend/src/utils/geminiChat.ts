/**
 * geminiChat.ts — AI shopping assistant fallback using Google Gemini (direct fetch).
 *
 * Used as fallback when Cloudflare Workers AI is unavailable.
 * Uses the same working models as geminiVision.ts (gemini-3.8-flash, gemini-3.5-flash).
 * Direct fetch avoids SDK issues; 10s timeout to prevent hangs.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatFilters {
  category?: string;      // "smartphone"|"laptop"|"tablet"|"audio"|"home"|"fashion"|"beauty"|"health"
  maxPrice?: number;      // THB
  minPrice?: number;      // THB
  brands?: string[];      // ["Apple", "Samsung"]
  keywords?: string[];    // free-text keywords for $regex search
  compareMode?: boolean;  // user wants side-by-side comparison
  sortBy?: "price" | "rating" | "reviews";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ProductSummary {
  name: string;
  brand: string;
  minPrice: number;
  platform: string;
  rating: number;
  category: string;
}

// ── Model sequence (working models for this API key) ──────────────────────────

const GEMINI_MODELS = [
  { model: "gemini-3.8-flash", apiVersion: "v1beta" as const },
  { model: "gemini-3.8-flash", apiVersion: "v1"     as const },
  { model: "gemini-3.5-flash", apiVersion: "v1beta" as const },
  { model: "gemini-3.5-flash", apiVersion: "v1"     as const },
];

const FETCH_TIMEOUT_MS = 10_000; // 10s — chat needs to feel responsive

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function callGemini(
  modelName: string,
  apiVersion: "v1beta" | "v1",
  promptText: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw Object.assign(new Error(errBody.slice(0, 300)), { status: response.status });
    }

    const json = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

async function tryGemini(promptText: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  for (const { model, apiVersion } of GEMINI_MODELS) {
    try {
      const text = await callGemini(model, apiVersion, promptText, apiKey);
      if (text) return text;
    } catch (err: any) {
      const status  = err?.status ?? 0;
      const is404   = status === 404 || (err as Error).message.includes("404");
      const is429   = status === 429 || (err as Error).message.includes("quota");
      const isAbort = (err as Error).name === "AbortError";
      console.warn(`[GeminiChat] ${model} (${apiVersion}) failed status=${status}:`,
        isAbort ? "TIMEOUT" : (err as Error).message.slice(0, 80));
      if (is404 || is429) break; // skip remaining models
    }
  }
  return null;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

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

const ASSISTANT_SYSTEM = `คุณคือ "PriceBot" ผู้ช่วยช้อปปิ้งสุดเซียนของเว็บ PriceCompare ที่รวมราคาจาก Lazada, Shopee, JIB, Power Buy และอีกหลายร้าน

สไตล์การตอบ:
- ภาษาไทยเป็นกันเอง เหมือนเพื่อนที่รู้จักสินค้าดี
- ใช้ emoji ประกอบเล็กน้อย (💰 ราคา / ⭐ เรตติ้ง / 🏆 แนะนำ / 🛒 ซื้อได้ที่)
- กระชับ ตรงประเด็น ไม่เกิน 120 คำ
- ขึ้นต้นด้วยประโยคสรุปสั้นๆ 1 บรรทัด แล้วแนะนำแต่ละรุ่น

กฎเหล็ก:
- ใช้เฉพาะข้อมูลจากรายการสินค้าที่ระบบให้มาเท่านั้น ห้ามสร้างราคาหรือชื่อสินค้าขึ้นเอง
- ระบุ ฿ราคาต่ำสุด และชื่อแพลตฟอร์มทุกครั้ง
- ถ้ามีสินค้าน้อย (1-2 รุ่น) ให้บอกตรงๆ ว่ามีแค่นี้ในระบบ`;

// ── Public API ────────────────────────────────────────────────────────────────

export async function extractFilters(
  userMessage: string,
  history: ChatMessage[]
): Promise<ChatFilters> {
  const context = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = context
    ? `${FILTER_PROMPT}\n\nConversation context:\n${context}\n\nNow extract filters for: "${userMessage}"`
    : `${FILTER_PROMPT}\n\nUser message: "${userMessage}"`;

  try {
    const text = await tryGemini(prompt);
    if (!text) return {};
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]) as ChatFilters;
  } catch {
    return {};
  }
}

export async function generateResponse(
  userMessage: string,
  history: ChatMessage[],
  products: ProductSummary[],
  filters: ChatFilters
): Promise<string> {
  const productContext =
    products.length > 0
      ? `สินค้าที่พบในระบบ (${products.length} รายการ):\n` +
        products
          .slice(0, 6)
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

${historyText ? `ประวัติการสนทนา:\n${historyText}\n` : ""}ข้อมูลสินค้าจากระบบ:
${productContext}

เงื่อนไขที่ค้นหา: ${filtersText || "ทั่วไป"}

ผู้ใช้ถามว่า: "${userMessage}"

ตอบกลับเป็นภาษาไทย:`;

  const text = await tryGemini(prompt);
  if (text) return text;

  console.error("[GeminiChat] All models failed — returning fallback message");
  return "ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
}
