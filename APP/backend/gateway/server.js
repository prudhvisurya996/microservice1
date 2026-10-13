import { loadServices } from "../lib/catalog.js";
import { audit } from "../lib/data.js";
import { start } from "../lib/http.js";

const urls = {
  catalog: process.env.CATALOG_URL || "http://127.0.0.1:4001",
  search: process.env.SEARCH_URL || "http://127.0.0.1:4002",
  pricing: process.env.PRICING_URL || "http://127.0.0.1:4003",
  inventory: process.env.INVENTORY_URL || "http://127.0.0.1:4004",
  cart: process.env.CART_URL || "http://127.0.0.1:4005",
  order: process.env.ORDER_URL || "http://127.0.0.1:4006",
  payment: process.env.PAYMENT_URL || "http://127.0.0.1:4007",
  shipping: process.env.SHIPPING_URL || "http://127.0.0.1:4008",
  review: process.env.REVIEW_URL || "http://127.0.0.1:4009",
  user: process.env.USER_URL || "http://127.0.0.1:4010",
  notification: process.env.NOTIFICATION_URL || "http://127.0.0.1:4011",
  recommendation: process.env.RECOMMENDATION_URL || "http://127.0.0.1:4012",
  auth: process.env.AUTH_URL || "http://127.0.0.1:4013",
  verification: process.env.VERIFICATION_URL || "http://127.0.0.1:4014",
  tracking: process.env.TRACKING_URL || "http://127.0.0.1:4015",
};

async function hop(trace, service, path, options = {}) {
  const started = performance.now();
  try {
    const res = await fetch(urls[service] + path, {
      method: options.method || "GET",
      headers: { "content-type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    const ms = Math.round(performance.now() - started);
    trace.push({ service, method: options.method || "GET", path, status: res.status, ms });
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    trace.push({
      service,
      method: options.method || "GET",
      path,
      status: 0,
      ms,
      error: error instanceof Error ? error.message : "unreachable",
    });
    return { ok: false, status: 0, body: { error: "unreachable" } };
  }
}

function homePage() {
  const rows = loadServices()
    .map(
      (service) =>
        `<tr><td>${service.layer}</td><td>${service.name}</td><td>${service.port ?? "—"}</td><td>${service.summary}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RelayMart gateway</title>
<style>body{font:16px/1.45 system-ui,sans-serif;margin:2rem;background:#f3efe6;color:#1c2430}td,th{border-bottom:1px solid #ddd4c4;text-align:left;padding:.45rem .5rem;vertical-align:top}table{border-collapse:collapse;width:100%}</style>
</head><body><h1>RelayMart API gateway</h1><p>The shop calls this process only. <code>POST /api/checkout</code> runs the saga.</p>
<table><thead><tr><th>Layer</th><th>Service</th><th>Port</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

start({
  name: process.env.SERVICE_NAME || "gateway",
  cors: true,
  routes: [
    { method: "GET", path: "/", handler: () => ({ contentType: "text/html; charset=utf-8", body: homePage() }) },
    { method: "GET", path: "/api/services", handler: () => ({ body: { services: loadServices() } }) },
    {
      method: "GET",
      path: "/api/catalog/products",
      async handler({ query }) {
        const category = query.get("category");
        const path = category ? `/products?category=${encodeURIComponent(category)}` : "/products";
        const result = await hop([], "catalog", path);
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "GET",
      path: "/api/catalog/products/:id",
      async handler({ params }) {
        const result = await hop([], "catalog", `/products/${params.id}`);
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "GET",
      path: "/api/search",
      async handler({ query }) {
        const result = await hop([], "search", `/search?q=${encodeURIComponent(query.get("q") || "")}`);
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "GET",
      path: "/api/reviews/:id",
      async handler({ params }) {
        const result = await hop([], "review", `/products/${params.id}/reviews`);
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/quote",
      async handler({ body }) {
        const result = await hop([], "pricing", "/quote", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/eta",
      async handler({ body }) {
        const result = await hop([], "shipping", "/eta", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "GET",
      path: "/api/orders",
      async handler() {
        const result = await hop([], "order", "/orders");
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/assistant",
      async handler({ body }) {
        const result = await hop([], "recommendation", "/assist", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/register",
      async handler({ body }) {
        const result = await hop([], "auth", "/register", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/login",
      async handler({ body }) {
        const result = await hop([], "auth", "/login", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/verify/email/send",
      async handler({ body }) {
        const result = await hop([], "verification", "/email/send", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/verify/mobile/send",
      async handler({ body }) {
        const result = await hop([], "verification", "/mobile/send", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/verify/email/confirm",
      async handler({ body }) {
        const result = await hop([], "verification", "/email/confirm", { method: "POST", body });
        if (!result.ok) return { status: result.status || 502, body: result.body };
        const marked = await hop([], "auth", "/mark-verified", {
          method: "POST",
          body: { channel: "email", value: body.email },
        });
        return { status: marked.ok ? 200 : marked.status || 502, body: { ...result.body, account: marked.body } };
      },
    },
    {
      method: "POST",
      path: "/api/verify/mobile/confirm",
      async handler({ body }) {
        const result = await hop([], "verification", "/mobile/confirm", { method: "POST", body });
        if (!result.ok) return { status: result.status || 502, body: result.body };
        const marked = await hop([], "auth", "/mark-verified", {
          method: "POST",
          body: { channel: "mobile", value: body.mobile },
        });
        return { status: marked.ok ? 200 : marked.status || 502, body: { ...result.body, account: marked.body } };
      },
    },
    {
      method: "POST",
      path: "/api/tracking/shipments",
      async handler({ body }) {
        const result = await hop([], "tracking", "/shipments", { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/tracking/shipments/:id/scan",
      async handler({ params, body }) {
        const result = await hop([], "tracking", `/shipments/${params.id}/scan`, { method: "POST", body });
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "GET",
      path: "/api/tracking/shipments/:id",
      async handler({ params }) {
        const result = await hop([], "tracking", `/shipments/${params.id}`);
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/orders/:id/cancel",
      async handler({ params, body }) {
        const result = await hop([], "order", `/orders/${params.id}/cancel`, { method: "POST", body: {} });
        if (result.ok) {
          audit("gateway", "order", "cancelled", {
            user: { email: String(body.email || "") },
            order: { id: params.id },
          });
        }
        return { status: result.status || 502, body: result.body };
      },
    },
    {
      method: "POST",
      path: "/api/logout",
      handler({ body }) {
        audit("gateway", "authentication", "logout", { user: { email: String(body.email || "") } });
        return { body: { ok: true } };
      },
    },
    {
      method: "POST",
      path: "/api/checkout",
      async handler({ body }) {
        const trace = [];
        const lines = Array.isArray(body.lines) ? body.lines : [];
        if (!lines.length) return { status: 400, body: { error: "lines required", trace } };

        const user = await hop(trace, "user", "/users/demo");
        if (!user.ok) return { status: 502, body: { error: "user_unavailable", trace } };

        const priced = await hop(trace, "pricing", "/quote", {
          method: "POST",
          body: { lines, coupon: body.coupon || "" },
        });
        if (!priced.ok) return { status: priced.status || 502, body: { error: "pricing_failed", trace, detail: priced.body } };

        const reserved = await hop(trace, "inventory", "/reserve", { method: "POST", body: { lines } });
        if (!reserved.ok) return { status: reserved.status || 409, body: { error: "inventory_failed", trace, detail: reserved.body } };

        const eta = await hop(trace, "shipping", "/eta", {
          method: "POST",
          body: { pincode: body.pincode, lines },
        });
        if (!eta.ok) {
          await hop(trace, "inventory", "/release", { method: "POST", body: { reservationId: reserved.body.reservationId } });
          return { status: eta.status || 400, body: { error: "shipping_failed", trace, detail: eta.body } };
        }

        const pay = await hop(trace, "payment", "/authorize", {
          method: "POST",
          body: { amount: priced.body.total, method: body.method || "upi", forceFail: Boolean(body.forceFail) },
        });
        if (!pay.ok) {
          await hop(trace, "inventory", "/release", { method: "POST", body: { reservationId: reserved.body.reservationId } });
          return { status: 402, body: { error: "payment_declined", trace, priced: priced.body } };
        }

        const order = await hop(trace, "order", "/orders", {
          method: "POST",
          body: {
            userId: body.email || user.body.user?.id || "guest",
            lines: priced.body.lines,
            total: priced.body.total,
            paymentId: pay.body.paymentId,
            pincode: body.pincode,
            address: body.address || "",
            etaDays: eta.body.days,
            method: body.method || "upi",
          },
        });
        if (!order.ok) {
          await hop(trace, "inventory", "/release", { method: "POST", body: { reservationId: reserved.body.reservationId } });
          return { status: 502, body: { error: "order_failed", trace } };
        }

        await hop(trace, "inventory", "/commit", { method: "POST", body: { reservationId: reserved.body.reservationId } });
        const tracked = await hop(trace, "tracking", "/shipments", {
          method: "POST",
          body: { orderId: order.body.order?.id, pincode: body.pincode },
        });
        const items = (priced.body.lines || []).map((line) => `${line.name} x${line.qty}`).join(", ");
        audit("gateway", "order", "placed", {
          user: { email: body.email || "" },
          order: {
            id: order.body.order?.id,
            items,
            amount: priced.body.total,
            pincode: body.pincode || "",
            address: body.address || "",
            etaDays: eta.body.days,
          },
          payment: { id: pay.body.paymentId, method: body.method || "upi" },
          shipment: { id: tracked.body?.id || "" },
        });
        await hop(trace, "notification", "/notify", {
          method: "POST",
          body: {
            type: "order_placed",
            to: user.body.user?.email,
            message: `Order ${order.body.order?.id} placed`,
          },
        });
        await hop(trace, "cart", "/carts/clear", { method: "POST", body: { userId: user.body.user?.id || "asha" } });

        return {
          status: 201,
          body: {
            status: "order_placed_successful",
            message: `Order placed successful. Delivery in ${eta.body.days} days.`,
            order: order.body.order,
            trace,
            priced: priced.body,
            eta: eta.body,
            payment: pay.body,
          },
        };
      },
    },
  ],
});
