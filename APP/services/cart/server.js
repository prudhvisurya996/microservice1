import { randomUUID } from "node:crypto";
import { start } from "../../lib/http.js";

const carts = new Map();

start({
  name: process.env.SERVICE_NAME || "cart",
  routes: [
    {
      method: "POST",
      path: "/carts",
      handler({ body }) {
        const id = randomUUID();
        carts.set(id, { id, userId: body.userId || "asha", items: [] });
        return { status: 201, body: { cart: carts.get(id) } };
      },
    },
    {
      method: "GET",
      path: "/carts/:id",
      handler({ params }) {
        const cart = carts.get(params.id);
        if (!cart) return { status: 404, body: { error: "not_found" } };
        return { body: { cart } };
      },
    },
    {
      method: "POST",
      path: "/carts/:id/items",
      handler({ params, body }) {
        const cart = carts.get(params.id);
        if (!cart) return { status: 404, body: { error: "not_found" } };
        const qty = Number(body.qty) || 1;
        const existing = cart.items.find((item) => item.productId === body.productId);
        if (existing) existing.qty += qty;
        else cart.items.push({ productId: body.productId, qty });
        return { body: { cart } };
      },
    },
    {
      method: "POST",
      path: "/carts/clear",
      handler({ body }) {
        let cleared = 0;
        for (const cart of carts.values()) {
          if (!body.userId || cart.userId === body.userId) {
            cart.items = [];
            cleared += 1;
          }
        }
        return { body: { cleared } };
      },
    },
  ],
});
