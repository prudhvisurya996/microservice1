import { findProduct, loadCatalog } from "../../lib/catalog.js";
import { start } from "../../lib/http.js";

const catalog = loadCatalog();

start({
  name: process.env.SERVICE_NAME || "catalog",
  routes: [
    {
      method: "GET",
      path: "/categories",
      handler() {
        return { body: { categories: catalog.categories } };
      },
    },
    {
      method: "GET",
      path: "/products",
      handler({ query }) {
        const category = query.get("category");
        const products = catalog.products.filter((product) => !category || product.category === category);
        return { body: { products } };
      },
    },
    {
      method: "GET",
      path: "/products/:id",
      handler({ params }) {
        const product = findProduct(catalog, params.id);
        if (!product) return { status: 404, body: { error: "not_found" } };
        return { body: { product } };
      },
    },
  ],
});
