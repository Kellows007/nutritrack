// Server-only route: the Claude API key never reaches the browser.
// Receives one receipt photo, asks Claude to read it, returns a clean list of items.
// The photo is not stored anywhere (architecturedoc.md, Security rules).

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB after client-side resize
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const PROMPT = `You are reading a photo of a Spanish supermarket receipt (for example Mercadona, Lidl, Carrefour or Dia).
Return ONLY a JSON object, no other text, in this exact shape:
{"store": string or null, "items": [{"name": string, "quantity": number, "unit": "ud" | "kg" | "g" | "l" | "ml", "price": number, "expiry_days": number}]}
Rules:
- One entry per product line. Expand abbreviations into a clear product name in Spanish (e.g. "LECHE ENTERA 1L" -> "Leche entera 1 L").
- quantity and unit come from the receipt; if not shown use 1 and "ud".
- price is the total price of that line in euros.
- expiry_days is your best guess of how many days the product lasts at home (fresh meat 2, fish 1, bread 3, fruit 5, vegetables 5, milk 7, eggs 21, yogurt 14, dry/canned food 180). It is only an estimate; the user can change it.
- Skip totals, taxes, payment lines, discounts and bags.`;

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "The server has no ANTHROPIC_API_KEY. Add it to .env.local (local) or to the Vercel environment variables." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { image, mediaType } = body || {};
  if (typeof image !== "string" || !ALLOWED.includes(mediaType)) {
    return Response.json({ error: "Please upload a JPG, PNG or WEBP photo." }, { status: 400 });
  }
  if (Buffer.byteLength(image, "base64") > MAX_BYTES) {
    return Response.json({ error: "The photo is too large (max 5 MB)." }, { status: 413 });
  }

  const started = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Claude API error", res.status, detail.slice(0, 500));
    return Response.json({ error: "Claude could not read the receipt. Try again." }, { status: 502 });
  }

  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const parsed = parseJson(text);
  if (!parsed || !Array.isArray(parsed.items)) {
    return Response.json({ error: "Claude's answer was not in the expected format. Try again." }, { status: 502 });
  }

  const items = parsed.items
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim().slice(0, 80),
      quantity: num(i.quantity, 1),
      unit: ["ud", "kg", "g", "l", "ml"].includes(i.unit) ? i.unit : "ud",
      price: num(i.price, 0),
      expiry_days: Math.round(num(i.expiry_days, 7)),
    }));

  return Response.json({ store: parsed.store || null, items, ai_ms: Date.now() - started });
}

function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function num(v, fallback) {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
