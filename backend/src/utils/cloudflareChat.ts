/**
 * cloudflareChat.ts — AI shopping assistant powered by Cloudflare Workers AI (Llama text models).
 *
 * Uses the same CF_ACCOUNT_ID + CF_API_TOKEN as cloudflareVision.ts.
 * Free tier: 10,000 neurons/day — reliable, no quota exhaustion.
 *
 * Models tried in order:
 *   1. @cf/meta/llama-3.3-70b-instruct-fp8-fast — best quality, fast
 *   2. @cf/meta/llama-3.1-8b-instruct          — reliable fallback
 */

import type { ChatFilters, ChatMessage } from "./geminiChat.js";

// ── Models ────────────────────────────────────────────────────────────────────

const CF_TEXT_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct",
];

// ── Prompts ───────────────────────────────────────────────────────────────────

const FILTER_SYSTEM = `You are a filter extractor for a Thai e-commerce price comparison website.

Extract search filters from the user's message and return ONLY valid JSON. No markdown, no explanation.

Output format:
{
  "category": "smartphone|laptop|tablet|audio|home|fashion|beauty|health|null",
  "maxPrice": number_or_null,
  "minPrice": number_or_null,
  "brands": ["brand names in English"] or [],
  "keywords": ["short English keywords for product search"] or [],
  "compareMode": true_if_user_wants_side_by_side_comparison_else_false,
  "sortBy": "price|rating|reviews|null"
}

Examples:
- "โทรศัพท์ไม่เกิน 15000 กล้องดี" → {"category":"smartphone","maxPrice":15000,"minPrice":null,"brands":[],"keywords":["good camera"],"compareMode":false,"sortBy":null}
- "เปรียบเทียบ iPhone vs Samsung" → {"category":"smartphone","maxPrice":null,"minPrice":null,"brands":["Apple","Samsung"],"keywords":[],"compareMode":true,"sortBy":null}
- "หูฟัง Sony ราคาถูกที่สุด" → {"category":"audio","maxPrice":null,"minPrice":null,"brands":["Sony"],"keywords":[],"compareMode":false,"sortBy":"price"}
- "แล็ปท็อปสำหรับทำงาน งบ 20000-30000" → {"category":"laptop","maxPrice":30000,"minPrice":20000,"brands":[],"keywords":["work","office"],"compareMode":false,"sortBy":null}

Rules:
- ราคา/งบ/ไม่เกิน → maxPrice
- ราคาตั้งแต่/อย่างน้อย → minPrice
- ถูกที่สุด/ราคาต่ำสุด → sortBy:"price"
- ดีที่สุด/รีวิวดี → sortBy:"rating"
- Return ONLY the JSON object, nothing else`;

const ASSISTANT_SYSTEM = `คุณคือ "PriceBot" ผู้ช่วยช้อปปิ้งสุดเซียนของเว็บ PriceCompare ที่รวมราคาจาก Lazada, Shopee, JIB, Power Buy และอีกหลายร้าน

สไตล์การตอบ:
- ภาษาไทยเป็นกันเอง เหมือนเพื่อนที่รู้จักสินค้าดี
- ใช้ emoji ประกอบเล็กน้อย (💰 ราคา / ⭐ เรตติ้ง / 🏆 แนะนำ / 🛒 ซื้อได้ที่)
- กระชับ ตรงประเด็น ไม่เกิน 120 คำ
- ขึ้นต้นด้วยประโยคสรุปสั้นๆ 1 บรรทัด แล้วแนะนำแต่ละรุ่น

กฎเหล็ก (สำคัญมาก):
- ใช้เฉพาะข้อมูลจากรายการสินค้าที่ระบบให้มาเท่านั้น ห้ามสร้างราคา ชื่อสินค้า หรือแพลตฟอร์มขึ้นเอง
- ถ้าบอกว่า "ไม่พบสินค้า" ให้แนะนำให้ลองปรับงบหรือค้นหาด้วยคำอื่น
- ระบุ ฿ราคาต่ำสุด และชื่อแพลตฟอร์มทุกครั้ง
- ถ้ามีสินค้าน้อย (1-2 รุ่น) ให้บอกตรงๆ ว่ามีแค่นี้ในระบบ แต่ยังแนะนำให้ดีที่สุด`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductSummary {
  name: string;
  brand: string;
  minPrice: number;
  platform: string;
  rating: number;
  category: string;
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function callCF(
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number,
  accountId: string,
  apiToken: string
): Promise<string> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw Object.assign(new Error(errBody.slice(0, 300)), { status: response.status });
  }

  const json = await response.json() as {
    result?: unknown;
    success?: boolean;
    errors?: { message: string }[];
  };

  if (json.success === false) {
    const msg = (json.errors as any)?.[0]?.message ?? "Unknown Cloudflare error";
    throw new Error(msg);
  }

  const r = json.result as any;

  if (typeof r?.response === "string")      return r.response.trim();
  if (r?.response && typeof r.response === "object") return JSON.stringify(r.response);
  if (Array.isArray(r?.choices))            return (r.choices[0]?.message?.content ?? "").trim();
  if (typeof r?.generated_text === "string") return r.generated_text.trim();
  if (typeof r === "string")                return r.trim();

  throw new Error("CF text: unexpected response format — " + JSON.stringify(r).slice(0, 150));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract structured search filters from a Thai user message.
 * Returns null if CF is not configured or all models fail.
 */
export async function extractFiltersWithCloudflare(
  userMessage: string,
  history: ChatMessage[]
): Promise<ChatFilters | null> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken  = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) return null;

  const context = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const userContent = context
    ? `Conversation context:\n${context}\n\nExtract filters for: "${userMessage}"`
    : `Extract filters for: "${userMessage}"`;

  const messages = [
    { role: "system", content: FILTER_SYSTEM },
    { role: "user",   content: userContent },
  ];

  for (const model of CF_TEXT_MODELS) {
    try {
      const text = await callCF(model, messages, 512, 0.1, accountId, apiToken);
      console.log(`[CFChat] extractFilters ${model}:`, text.slice(0, 150));

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.warn("[CFChat] No JSON in filter response"); continue; }

      const parsed = JSON.parse(jsonMatch[0]) as ChatFilters;
      console.log("[CFChat] ✅ Filters extracted:", JSON.stringify(parsed));
      return parsed;
    } catch (err: any) {
      console.warn(`[CFChat] extractFilters ${model} failed:`, (err as Error).message.slice(0, 100));
    }
  }

  return null; // all models failed — caller will use Gemini fallback
}

/**
 * Generate a Thai-language shopping recommendation response.
 * Returns null if CF is not configured or all models fail.
 */
export async function generateResponseWithCloudflare(
  userMessage: string,
  history: ChatMessage[],
  products: ProductSummary[],
  filters: ChatFilters
): Promise<string | null> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken  = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) return null;

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
    .filter(([, v]) => v !== null && v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");

  // Pass keyword preferences as AI hints (not used for DB filtering)
  const preferenceHint = filters.keywords && filters.keywords.length > 0
    ? `ความต้องการพิเศษของผู้ใช้: ${filters.keywords.join(", ")} — ใช้ความรู้ของคุณเลือกรุ่นที่เหมาะจากรายการด้านบน`
    : "";

  const userContent = [
    historyText ? `ประวัติการสนทนา:\n${historyText}` : "",
    `ข้อมูลสินค้าจากระบบ:\n${productContext}`,
    preferenceHint,
    `เงื่อนไขที่ค้นหา: ${filtersText || "ทั่วไป"}`,
    `ผู้ใช้ถามว่า: "${userMessage}"`,
    `\nตอบกลับเป็นภาษาไทย:`,
  ].filter(Boolean).join("\n\n");

  const messages = [
    { role: "system", content: ASSISTANT_SYSTEM },
    { role: "user",   content: userContent },
  ];

  for (const model of CF_TEXT_MODELS) {
    try {
      const text = await callCF(model, messages, 1024, 0.3, accountId, apiToken);
      console.log(`[CFChat] generateResponse ${model}:`, text.slice(0, 100));
      if (text) return text;
    } catch (err: any) {
      console.warn(`[CFChat] generateResponse ${model} failed:`, (err as Error).message.slice(0, 100));
    }
  }

  return null; // all models failed — caller will use Gemini fallback
}
