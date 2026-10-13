import { create } from "zustand";
import { productById } from "@/lib/catalog";
import { traceAdd, traceCheckout, traceRecommend, traceSearch, traceView, type Span } from "@/lib/mesh";

export type CartLine = { productId: string; qty: number };

export type Order = {
  id: string;
  lines: { productId: string; name: string; qty: number; unit: number; line: number; offer: string }[];
  total: number;
  couponOff: number;
  method: string;
  pincode: string;
  etaDays: number;
  hub: string;
  at: number;
  spans: Span[];
};

type CheckoutView =
  | { ok: true; orderId: string; spans: Span[] }
  | { ok: false; message: string; spans: Span[] }
  | null;

type Persisted = {
  cart: CartLine[];
  orders: Order[];
  logs: Span[];
  stock: Record<string, number>;
};

const KEY = "relaymart-lab-v1";

function read(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

function write(state: Persisted) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function push(logs: Span[], spans: Span[]) {
  return [...spans].reverse().concat(logs).slice(0, 200);
}

type MeshState = Persisted & {
  hydrated: boolean;
  last: CheckoutView;
  hydrate: () => void;
  available: (id: string) => number;
  add: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  noteView: (productId: string) => void;
  noteSearch: (query: string) => void;
  noteRecommend: (query: string) => void;
  checkout: (input: { coupon: string; pincode: string; method: string; forceFail: boolean }) => void;
  sample: () => void;
  clearLogs: () => void;
};

export const useMesh = create<MeshState>((set, get) => ({
  cart: [],
  orders: [],
  logs: [],
  stock: {},
  hydrated: false,
  last: null,
  hydrate: () => {
    if (get().hydrated) return;
    const saved = read();
    set((state) => ({
      cart: state.cart.length ? state.cart : (saved.cart ?? []),
      orders: state.orders.length ? state.orders : (saved.orders ?? []),
      logs: state.logs.length ? state.logs : (saved.logs ?? []),
      stock: Object.keys(state.stock).length ? state.stock : (saved.stock ?? {}),
      hydrated: true,
    }));
  },
  available: (id) => {
    const product = productById(id);
    if (!product) return 0;
    return get().stock[id] ?? product.stock;
  },
  add: (productId) => {
    const product = productById(productId);
    if (!product) return;
    const state = get();
    const inCart = state.cart.find((line) => line.productId === productId)?.qty ?? 0;
    if (inCart >= state.available(productId) || inCart >= 4) return;
    const cart = inCart
      ? state.cart.map((line) => (line.productId === productId ? { ...line, qty: line.qty + 1 } : line))
      : [...state.cart, { productId, qty: 1 }];
    const logs = push(state.logs, traceAdd(product));
    set({ cart, logs });
    write({ cart, orders: state.orders, logs, stock: state.stock });
  },
  setQty: (productId, qty) => {
    const state = get();
    const cap = Math.min(4, state.available(productId));
    const next = Math.max(0, Math.min(cap, qty));
    const cart = next === 0
      ? state.cart.filter((line) => line.productId !== productId)
      : state.cart.map((line) => (line.productId === productId ? { ...line, qty: next } : line));
    set({ cart });
    write({ cart, orders: state.orders, logs: state.logs, stock: state.stock });
  },
  noteView: (productId) => {
    const product = productById(productId);
    if (!product) return;
    const state = get();
    const logs = push(state.logs, traceView(product));
    set({ logs });
    write({ cart: state.cart, orders: state.orders, logs, stock: state.stock });
  },
  noteSearch: (query) => {
    const state = get();
    const logs = push(state.logs, traceSearch(query));
    set({ logs });
    write({ cart: state.cart, orders: state.orders, logs, stock: state.stock });
  },
  noteRecommend: (query) => {
    const state = get();
    const logs = push(state.logs, traceRecommend(query));
    set({ logs });
    write({ cart: state.cart, orders: state.orders, logs, stock: state.stock });
  },
  checkout: (input) => {
    const state = get();
    const result = traceCheckout({
      lines: state.cart,
      ...input,
      available: (id) => state.available(id),
    });
    if (!result.ok) {
      const logs = push(state.logs, result.spans);
      set({ logs, last: { ok: false, message: result.message, spans: result.spans } });
      write({ cart: state.cart, orders: state.orders, logs, stock: state.stock });
      return;
    }
    const stock = { ...state.stock };
    for (const line of state.cart) stock[line.productId] = state.available(line.productId) - line.qty;
    const orders = [result.order, ...state.orders];
    const logs = push(state.logs, result.spans);
    set({ cart: [], stock, orders, logs, last: { ok: true, orderId: result.order.id, spans: result.spans } });
    write({ cart: [], orders, logs, stock });
  },
  sample: () => {
    const state = get();
    const product = productById("fieldline-14");
    if (!product || state.available(product.id) < 1) return;
    const result = traceCheckout({
      lines: [{ productId: product.id, qty: 1 }],
      coupon: "STUDIO",
      pincode: "560001",
      method: "upi",
      forceFail: false,
      available: (id) => state.available(id),
    });
    if (!result.ok) return;
    const stock = { ...state.stock, [product.id]: state.available(product.id) - 1 };
    const orders = [result.order, ...state.orders];
    const logs = push(state.logs, result.spans);
    set({ stock, orders, logs, last: { ok: true, orderId: result.order.id, spans: result.spans } });
    write({ cart: state.cart, orders, logs, stock });
  },
  clearLogs: () => {
    const state = get();
    set({ logs: [], last: null });
    write({ cart: state.cart, orders: state.orders, logs: [], stock: state.stock });
  },
}));
