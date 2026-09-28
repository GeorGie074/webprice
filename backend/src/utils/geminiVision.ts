/**
 * geminiVision.ts — Identify a product from an image using Google Gemini.
 *
 * Uses direct fetch to /v1/ endpoint (not v1beta) to avoid throttling.
 * Tries multiple models with retry on 503.
 */

export interface ProductIdentification {
  brand: string;
  name: string;
  model: string;
  keywords: string[];
  category: string;
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

const MODELS = [
  "gemini-2.5-flash-image",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

async function callGemini(
  modelName: string,
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  // Use v1 (not v1beta) to avoid throttling
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64Image } },
        ],
      }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.1 },
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
}

function parseResponse(text: string): ProductIdentification | null {
  if (!text || text === "null") return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) { console.warn("[GeminiVision] No JSON:", text.slice(0, 200)); return null; }
  const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);
  if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
    console.warn("[GeminiVision] Incomplete:", parsed); return null;
  }
  return parsed;
}

export async function identifyProductFromImage(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<ProductIdentification | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[GeminiVision] GEMINI_API_KEY not set");
    return null;
  }

  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[GeminiVision] Trying ${modelName} attempt=${attempt}...`);
        const text = await callGemini(modelName, base64Image, mimeType, apiKey);
        console.log(`[GeminiVision] ${modelName} response:`, text.slice(0, 200));
        const parsed = parseResponse(text);
        if (parsed) console.log(`[GeminiVision] ✅ ${parsed.brand} ${parsed.model} (${parsed.confidence})`);
        return parsed;
      } catch (err: any) {
        lastError = err as Error;
        const status = err?.status ?? 0;
        const is503 = status === 503 || lastError.message.includes("503") || lastError.message.includes("high demand");
        console.warn(`[GeminiVision] ❌ ${modelName} attempt=${attempt} status=${status}:`, lastError.message.slice(0, 120));
        if (is503 && attempt < 3) {
          const wait = attempt * 1500;
          console.log(`[GeminiVision] 503 → waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          break; // non-503 or exhausted retries → try next model
        }
      }
    }
  }

  throw lastError ?? new Error("All Gemini models unavailable");
}
