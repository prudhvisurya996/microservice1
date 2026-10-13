import { randomUUID } from "node:crypto";
import { loadCatalog } from "../../lib/catalog.js";
import { start } from "../../lib/http.js";

const catalog = loadCatalog();
const available = new Map(catalog.products.map((product) => [product.id, product.stock]));
const held = new Map();

start({
  name: process.env.SERVICE_NAME || "inventory",
  routes: [
    {
      method: "GET",
      path: "/stock/:id",
      handler({ params }) {
        if (!available.has(params.id)) return { status: 404, body: { error: "not_found" } };
        return { body: { productId: params.id, available: available.get(params.id) } };
      },
    },
    {
      method: "POST",
      path: "/reserve",
      handler({ body }) {
        const lines = (body.lines || []).map((line) => ({ productId: line.productId, qty: Number(line.qty) }));
        for (const line of lines) {
          const have = available.get(line.productId);
          if (have == null) return { status: 404, body: { error: "not_found", productId: line.productId } };
          if (have < line.qty) return { status: 409, body: { error: "insufficient", productId: line.productId, available: have } };
        }
        const reservationId = randomUUID();
        for (const line of lines) available.set(line.productId, available.get(line.productId) - line.qty);
        held.set(reservationId, lines);
        return { body: { reservationId } };
      },
    },
    {
      method: "POST",
      path: "/commit",
      handler({ body }) {
        if (!held.has(body.reservationId)) return { status: 404, body: { error: "unknown_reservation" } };
        held.delete(body.reservationId);
        return { body: { committed: true } };
      },
    },
    {
      method: "POST",
      path: "/release",
      handler({ body }) {
        const lines = held.get(body.reservationId);
        if (!lines) return { status: 404, body: { error: "unknown_reservation" } };
        for (const line of lines) available.set(line.productId, available.get(line.productId) + line.qty);
        held.delete(body.reservationId);
        return { body: { released: true } };
      },
    },
  ],
});
