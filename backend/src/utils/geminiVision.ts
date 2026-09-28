/**
 * geminiVision.ts — Identify a product from an image using Google Gemini Flash.
 *
 * Free tier: 1,500 requests/day — plenty for an educational project.
 * Tries gemini-3.8-flash first (newest), falls back to gemini-1.5-flash.
 * Retries once on 503 (high demand) before switching model.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface ProductIdentification {
  brand: string;       // e.g. "Apple", "Samsung"
  name: string;        // e.g. "iPhone 15 Pro Max"
  model: string;       // e.g. "15 Pro Max", "WH-1000XM5"
  keywords: string[];  // short English search terms
  category: string;    // one of our supported categories
  confidence: "high" | "medium" | "low";
}

const PROMPT = `You are a product identification expert for a Thai e-commerce price comparison website.

Analyze the image and identify the product shown.

Respond with ONLY a valid JSON object — no markdown, no explanation:
{
  "brand": "brand name in English (e.g. Apple, Samsung, Sony, Nike)",
  "name": "full product name (English preferred, e.g. iPhone 15 Pro Max, Sony WH-1000XM5)",
  "model": "specific model number or name only (e.g. 15 Pro Max, WH-1000XM5, Galaxy S24 Ultra)",
  "keywords": ["2-4 short English keywords for Thai e-commerce search", "be specific"],
  "category": "one of: smartphone, laptop, tablet, audio, home, fashion, beauty, health",
  "confidence": "high if product is clearly visible, medium if partially visible, low if uncertain"
}

If you cannot identify the product at all, respond with exactly: null`;

const MODELS = ["gemini-3.8-flash"];

function parseResponse(text: string): ProductIdentification | null {
  if (!text || text === "null") return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) { console.warn("[GeminiVision] No JSON in response:", text.slice(0, 200)); return null; }
  const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);
  if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
    console.warn("[GeminiVision] Incomplete response:", parsed); return null;
  }
  return parsed;
}

/**
 * Send a base64-encoded image to Gemini and get product identification.
 * Automatically retries on 503 and falls back to an older model if needed.
 */
export async function identifyProductFromImage(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<ProductIdentification | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("[GeminiVision] GEMINI_API_KEY not set");
    return null;
  }

  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    const delays = [1000, 2000, 4000]; // retry up to 3 times on 503
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          PROMPT,
          { inlineData: { mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64Image } },
        ]);
        const text = result.response.text().trim();
        console.log(`[GeminiVision] ${modelName} attempt=${attempt}:`, text.slice(0, 200));
        const parsed = parseResponse(text);
        if (parsed) console.log(`[GeminiVision] ✅ ${parsed.brand} ${parsed.model} (${parsed.confidence})`);
        return parsed;
      } catch (err) {
        lastError = err as Error;
        const is503 = lastError.message.includes("503") || lastError.message.includes("high demand") || lastError.message.includes("overloaded");
        console.warn(`[GeminiVision] ❌ ${modelName} attempt=${attempt}:`, lastError.message.slice(0, 150));
        if (is503 && attempt <= 3) {
          const wait = delays[attempt - 1];
          console.log(`[GeminiVision] 503 — waiting ${wait}ms before retry...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          break; // non-503 or exhausted retries
        }
      }
    }
  }

  throw lastError ?? new Error("All Gemini models unavailable");
}
