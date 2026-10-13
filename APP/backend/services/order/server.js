import { randomUUID } from "node:crypto";
import { start } from "../../lib/http.js";

const orders = [];

start({
  name: process.env.SERVICE_NAME || "order",
  routes: [
    {
      method: "POST",
      path: "/orders",
      handler({ body }) {
        const order = {
          id: `LN-${randomUUID().slice(0, 4).toUpperCase()}`,
          userId: body.userId || "asha",
          lines: body.lines || [],
          total: body.total,
          paymentId: body.paymentId,
          pincode: body.pincode,
          etaDays: body.etaDays,
          method: body.method,
          status: "placed",
          at: new Date().toISOString(),
        };
        orders.unshift(order);
        return { status: 201, body: { order } };
      },
    },
    {
      method: "GET",
      path: "/orders",
      handler() {
        return { body: { orders } };
      },
    },
  ],
});
