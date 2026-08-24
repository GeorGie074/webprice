/**
 * geminiVision.ts — Identify a product from an image using Google Gemini Flash.
 *
 * Free tier: 1,500 requests/day — plenty for an educational project.
 * Model: gemini-1.5-flash (stable, fast, supports image input)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface ProductIdentification {
  brand: string;          // e.g. "Apple", "Samsung"
  name: string;           // e.g. "iPhone 15 Pro Max"
  model: string;          // e.g. "15 Pro Max", "WH-1000XM5"
  keywords: string[];     // short English search terms ["iphone 15 pro", "apple phone"]
  category: string;       // one of our supported categories
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

/**
 * Send a base64-encoded image to Gemini Flash and get product identification.
 *
 * @param base64Image  Raw base64 string (no data:... prefix needed)
 * @param mimeType     e.g. "image/jpeg" | "image/png" | "image/webp"
 */
export async function identifyProductFromImage(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<ProductIdentification | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("[GeminiVision] GEMINI_API_KEY not set");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      PROMPT,
      {
        inlineData: {
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
          data: base64Image,
        },
      },
    ]);

    const text = result.response.text().trim();
    console.log("[GeminiVision] Raw response:", text.slice(0, 300));

    // Handle explicit null response
    if (text === "null" || text === "") return null;

    // Extract JSON (strip any accidental markdown code fence)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[GeminiVision] No JSON found in response:", text.slice(0, 200));
      return null;
    }

    const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);

    // Basic sanity check
    if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
      console.warn("[GeminiVision] Incomplete response:", parsed);
      return null;
    }

    console.log(`[GeminiVision] Identified: ${parsed.brand} ${parsed.model} (${parsed.confidence})`);
    return parsed;
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[GeminiVision] Error:", msg);
    // Re-throw with a cleaner message for the route to catch
    throw new Error(msg);
  }
}
