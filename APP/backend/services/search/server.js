import { loadCatalog } from "../../lib/catalog.js";
import { start } from "../../lib/http.js";

const catalog = loadCatalog();

start({
  name: process.env.SERVICE_NAME || "search",
  routes: [
    {
      method: "GET",
      path: "/search",
      handler({ query }) {
        const q = (query.get("q") || "").trim().toLowerCase();
        const products = catalog.products.filter((product) => {
          if (!q) return true;
          const hay = [product.name, product.blurb, product.category, ...(product.tags || [])].join(" ").toLowerCase();
          return hay.includes(q);
        });
        return { body: { query: q, products } };
      },
    },
  ],
});
