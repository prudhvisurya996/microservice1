import { createServerFn } from "@tanstack/react-start";
import { products } from "@/lib/catalog";

const ids = new Set(products.map((product) => product.id));

function parseModel(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { text?: string; productIds?: unknown };
    const productIds = Array.isArray(parsed.productIds)
      ? parsed.productIds.filter((id): id is string => typeof id === "string" && ids.has(id))
      : [];
    return { text: parsed.text || cleaned, productIds };
  } catch {
    return { text: cleaned, productIds: [] as string[] };
  }
}

export const askAssistant = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const prompt =
      typeof input === "object" && input && "prompt" in input && typeof input.prompt === "string"
        ? input.prompt.trim()
        : "";
    if (prompt.length < 2 || prompt.length > 300) throw new Error("Ask in 2–300 characters.");
    return { prompt };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available in this environment" };
    const list = products
      .map((product) => `${product.id}: ${product.name}, ${product.category}, ₹${product.price}. ${product.blurb}`)
      .join("\n");
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              'You are RelayMart, a classroom shopping assistant. Reply with JSON only: {"text":"one short paragraph","productIds":["id"]}. Recommend at most 3 ids from the catalog.',
          },
          { role: "user", content: `Catalog:\n${list}\n\nStudent: ${data.prompt}` },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parseModel(body.choices?.[0]?.message?.content ?? "");
    return { ok: true as const, text: parsed.text, productIds: parsed.productIds };
  });
