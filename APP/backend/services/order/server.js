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
          userId: body.userId || "guest",
          lines: body.lines || [],
          total: body.total,
          paymentId: body.paymentId,
          pincode: body.pincode,
          address: body.address || "",
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
    {
      method: "POST",
      path: "/orders/:id/cancel",
      handler({ params }) {
        const order = orders.find((item) => item.id === params.id);
        if (!order) return { status: 404, body: { error: "order_not_found" } };
        if (order.status === "cancelled") return { status: 409, body: { error: "already_cancelled", order } };
        order.status = "cancelled";
        order.cancelledAt = new Date().toISOString();
        return { body: { message: "Order cancelled", order } };
      },
    },
  ],
});
