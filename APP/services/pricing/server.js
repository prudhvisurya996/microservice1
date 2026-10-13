import { findProduct, loadCatalog } from "../../lib/catalog.js";
import { start } from "../../lib/http.js";

const catalog = loadCatalog();

start({
  name: process.env.SERVICE_NAME || "pricing",
  routes: [
    {
      method: "POST",
      path: "/quote",
      handler({ body }) {
        const lines = [];
        for (const line of body.lines || []) {
          const product = findProduct(catalog, line.productId);
          if (!product) return { status: 404, body: { error: "unknown_product", productId: line.productId } };
          const qty = Number(line.qty);
          if (!Number.isInteger(qty) || qty < 1 || qty > 4) return { status: 400, body: { error: "bad_qty" } };
          lines.push({
            productId: product.id,
            name: product.name,
            qty,
            unit: product.price,
            mrp: product.mrp,
            line: product.price * qty,
            offer: product.offer || null,
          });
        }
        if (!lines.length) return { status: 400, body: { error: "lines required" } };
        let total = lines.reduce((sum, line) => sum + line.line, 0);
        let couponOff = 0;
        const coupon = String(body.coupon || "").trim().toUpperCase();
        if (coupon === "STUDIO" && total >= 999) {
          couponOff = 100;
          total -= 100;
        }
        return { body: { lines, total, couponOff, coupon: couponOff ? "STUDIO" : null } };
      },
    },
  ],
});
