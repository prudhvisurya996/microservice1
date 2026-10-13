import { productById, type Product } from "@/lib/catalog";

export type Span = {
  id: string;
  traceId: string;
  service: string;
  status: number;
  ms: number;
  message: string;
  at: number;
};

const BASE: Record<string, number> = {
  gateway: 6,
  user: 9,
  pricing: 14,
  inventory: 18,
  shipping: 22,
  payment: 48,
  order: 16,
  notification: 11,
  cart: 8,
  catalog: 7,
  search: 12,
  review: 10,
  recommendation: 16,
};

function span(traceId: string, service: string, status: number, message: string): Span {
  return {
    id: crypto.randomUUID(),
    traceId,
    service,
    status,
    ms: (BASE[service] ?? 10) + Math.floor(Math.random() * 5),
    message,
    at: Date.now(),
  };
}

export function etaFor(pincode: string) {
  if (!/^\d{6}$/.test(pincode)) return null;
  if (pincode.startsWith("56")) return { hub: "Bengaluru", days: 1 };
  if (pincode.startsWith("40")) return { hub: "Mumbai", days: 2 };
  if (pincode.startsWith("11")) return { hub: "Delhi", days: 2 };
  return { hub: "National", days: 4 };
}

export function quoteLines(lines: { product: Product; qty: number }[], coupon: string) {
  const priced = lines.map((line) => ({
    productId: line.product.id,
    name: line.product.name,
    qty: line.qty,
    unit: line.product.price,
    line: line.product.price * line.qty,
    offer: line.product.offer,
  }));
  let total = priced.reduce((sum, line) => sum + line.line, 0);
  let couponOff = 0;
  if (coupon.trim().toUpperCase() === "STUDIO" && total >= 999) {
    couponOff = 100;
    total -= 100;
  }
  return { priced, total, couponOff };
}

export function traceView(product: Product) {
  const traceId = crypto.randomUUID();
  return [
    span(traceId, "gateway", 200, `GET /api/catalog/products/${product.id}`),
    span(traceId, "catalog", 200, `Read ${product.name}`),
    span(traceId, "pricing", 200, `Sell price ₹${product.price.toLocaleString("en-IN")}`),
    span(traceId, "inventory", 200, `Stock ${product.stock}`),
    span(traceId, "review", 200, `${product.reviewCount} reviews · ${product.rating}`),
  ];
}

export function traceSearch(query: string) {
  const traceId = crypto.randomUUID();
  return [
    span(traceId, "gateway", 200, `GET /api/search?q=${query}`),
    span(traceId, "search", 200, `Matched “${query}”`),
  ];
}

export function traceAdd(product: Product) {
  const traceId = crypto.randomUUID();
  return [
    span(traceId, "gateway", 200, "POST /api/cart"),
    span(traceId, "cart", 200, `Added 1 × ${product.name}`),
    span(traceId, "inventory", 200, "Checked availability"),
  ];
}

export function traceRecommend(query: string) {
  const traceId = crypto.randomUUID();
  return [
    span(traceId, "gateway", 200, "POST /api/assistant"),
    span(traceId, "recommendation", 200, `Ranked catalog for “${query}”`),
  ];
}

export function traceCheckout(input: {
  lines: { productId: string; qty: number }[];
  coupon: string;
  pincode: string;
  method: string;
  forceFail: boolean;
  available: (id: string) => number;
}) {
  const traceId = crypto.randomUUID();
  const spans: Span[] = [span(traceId, "gateway", 200, "POST /api/checkout accepted")];
  const resolved = input.lines.map((line) => {
    const product = productById(line.productId);
    return product ? { product, qty: line.qty } : null;
  });
  if (resolved.some((line) => !line)) {
    spans.push(span(traceId, "catalog", 404, "Unknown product"));
    return { ok: false as const, message: "Unknown product", spans, traceId };
  }
  const lines = resolved.filter((line): line is { product: Product; qty: number } => Boolean(line));
  spans.push(span(traceId, "user", 200, "Loaded classroom profile Asha Menon"));

  for (const line of lines) {
    if (input.available(line.product.id) < line.qty) {
      spans.push(span(traceId, "inventory", 409, `Not enough ${line.product.name}`));
      return { ok: false as const, message: `Not enough stock for ${line.product.name}`, spans, traceId };
    }
  }

  const quote = quoteLines(lines, input.coupon);
  spans.push(
    span(
      traceId,
      "pricing",
      200,
      quote.couponOff
        ? `Quote ${quote.total.toLocaleString("en-IN")} after STUDIO`
        : `Quote ${quote.total.toLocaleString("en-IN")}`,
    ),
  );
  spans.push(span(traceId, "inventory", 200, "Reserved stock"));

  const eta = etaFor(input.pincode.trim());
  if (!eta) {
    spans.push(span(traceId, "shipping", 400, "Pincode must be 6 digits"));
    spans.push(span(traceId, "inventory", 200, "Released reservation"));
    return { ok: false as const, message: "Use a 6-digit pincode", spans, traceId };
  }
  spans.push(span(traceId, "shipping", 200, `${eta.days} day via ${eta.hub}`));

  if (input.forceFail) {
    spans.push(span(traceId, "payment", 402, `${input.method.toUpperCase()} declined`));
    spans.push(span(traceId, "inventory", 200, "Released reservation"));
    spans.push(span(traceId, "gateway", 402, "Saga aborted. Cart unchanged"));
    return { ok: false as const, message: "Payment declined. Stock was released.", spans, traceId };
  }

  spans.push(span(traceId, "payment", 200, `${input.method.toUpperCase()} authorized`));
  const orderId = `LN-${Math.floor(1000 + Math.random() * 9000)}`;
  spans.push(span(traceId, "order", 201, `Created ${orderId}`));
  spans.push(span(traceId, "inventory", 200, "Committed reservation"));
  spans.push(span(traceId, "notification", 202, "Queued confirmation for Asha"));
  spans.push(span(traceId, "cart", 200, "Cleared cart"));

  return {
    ok: true as const,
    traceId,
    spans,
    order: {
      id: orderId,
      lines: quote.priced,
      total: quote.total,
      couponOff: quote.couponOff,
      method: input.method,
      pincode: input.pincode.trim(),
      etaDays: eta.days,
      hub: eta.hub,
      at: Date.now(),
      spans,
    },
  };
}
