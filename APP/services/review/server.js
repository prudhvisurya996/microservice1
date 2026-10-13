import { findProduct, loadCatalog } from "../../lib/catalog.js";
import { start } from "../../lib/http.js";

const catalog = loadCatalog();

start({
  name: process.env.SERVICE_NAME || "review",
  routes: [
    {
      method: "GET",
      path: "/products/:id/reviews",
      handler({ params }) {
        const product = findProduct(catalog, params.id);
        if (!product) return { status: 404, body: { error: "not_found" } };
        return {
          body: {
            productId: product.id,
            rating: product.rating,
            count: product.reviewCount,
            reviews: product.reviews,
          },
        };
      },
    },
  ],
});
