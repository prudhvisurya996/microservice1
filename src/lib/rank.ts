import { products, type Product } from "@/lib/catalog";

export function rankProducts(query: string, limit = 4): Product[] {
  const q = query.trim().toLowerCase();
  return [...products]
    .map((product) => {
      const hay = [product.name, product.blurb, product.category, ...product.tags].join(" ").toLowerCase();
      let score = product.rating;
      if (q && hay.includes(q)) score += 5;
      for (const word of q.split(/\s+/)) {
        if (word.length > 2 && hay.includes(word)) score += 1;
      }
      return { product, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.product);
}
