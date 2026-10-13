import { loadCatalog } from "../../lib/catalog.js";
import { start } from "../../lib/http.js";

const catalog = loadCatalog();

function rank(query, limit = 4) {
  const q = String(query || "").trim().toLowerCase();
  return [...catalog.products]
    .map((product) => {
      const hay = [product.name, product.blurb, product.category, ...(product.tags || [])].join(" ").toLowerCase();
      let score = product.rating;
      if (q && hay.includes(q)) score += 5;
      for (const word of q.split(/\s+/)) {
        if (word.length > 2 && hay.includes(word)) score += 1;
      }
      return { id: product.id, name: product.name, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function askModel(prompt) {
  const key = process.env.XAI_API_KEY;
  if (!key) return null;
  const list = catalog.products.map((product) => `${product.id}: ${product.name}, ${product.category}, ₹${product.price}`).join("\n");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            'You are RelayMart, a classroom shopping assistant. Reply with JSON only: {"text":"...","productIds":["id"]}. Use only catalog ids.',
        },
        { role: "user", content: `Catalog:\n${list}\n\nStudent: ${String(prompt).slice(0, 300)}` },
      ],
    }),
  });
  if (!res.ok) return { error: `xAI ${res.status}` };
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

start({
  name: process.env.SERVICE_NAME || "recommendation",
  routes: [
    {
      method: "POST",
      path: "/rank",
      handler({ body }) {
        return { body: { picks: rank(body.query, body.limit || 4) } };
      },
    },
    {
      method: "POST",
      path: "/assist",
      async handler({ body }) {
        const picks = rank(body.prompt || body.query, 4);
        try {
          const model = await askModel(body.prompt || "");
          return { body: { picks, model } };
        } catch (error) {
          return { body: { picks, model: null, modelError: error instanceof Error ? error.message : "model failed" } };
        }
      },
    },
  ],
});
