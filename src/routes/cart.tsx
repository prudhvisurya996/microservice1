import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { productById } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { quoteLines } from "@/lib/mesh";
import { useMesh } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const cart = useMesh((state) => state.cart);
  const setQty = useMesh((state) => state.setQty);
  const checkout = useMesh((state) => state.checkout);
  const last = useMesh((state) => state.last);
  const [coupon, setCoupon] = useState("STUDIO");
  const [pincode, setPincode] = useState("560001");
  const [method, setMethod] = useState("upi");
  const [forceFail, setForceFail] = useState(false);

  const lines = cart.flatMap((line) => {
    const product = productById(line.productId);
    return product ? [{ product, qty: line.qty }] : [];
  });
  const quote = quoteLines(lines, coupon);

  return (
    <Shell>
      <h1 className="font-display text-4xl">Cart</h1>
      {lines.length === 0 ? (
        <p className="mt-4 text-muted">
          The cart is empty. <Link to="/" search={{ q: "", cat: "" }} className="text-pine">Browse the aisle</Link>
        </p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <ul className="divide-y divide-line border-y border-line">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex gap-4 py-4">
                <img src={product.image} alt="" className="size-20 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl">{product.name}</h2>
                  <p className="text-sm tabular-nums">{inr(product.price)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg border border-line" onClick={() => setQty(product.id, qty - 1)} aria-label="Decrease quantity">−</button>
                    <span className="w-6 text-center tabular-nums">{qty}</span>
                    <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg border border-line" onClick={() => setQty(product.id, qty + 1)} aria-label="Increase quantity">+</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="h-fit rounded-lg border border-line bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              checkout({ coupon, pincode, method, forceFail });
            }}
          >
            <label className="block text-sm text-muted">
              Coupon
              <input value={coupon} onChange={(event) => setCoupon(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-paper px-3" />
            </label>
            <label className="mt-3 block text-sm text-muted">
              Pincode
              <input value={pincode} onChange={(event) => setPincode(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-paper px-3" />
            </label>
            <label className="mt-3 block text-sm text-muted">
              Payment
              <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-paper px-3">
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="cod">Cash on delivery</option>
              </select>
            </label>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={forceFail} onChange={(event) => setForceFail(event.target.checked)} />
              Decline the payment
            </label>
            <p className="mt-3 text-sm text-muted">
              {quote.couponOff ? `STUDIO − ${inr(quote.couponOff)}` : "STUDIO applies from ₹999"}
            </p>
            <p className="mt-1 font-display text-3xl tabular-nums">{inr(quote.total)}</p>
            <button type="submit" className="mt-4 min-h-11 w-full rounded-lg bg-pine text-paper">Place order</button>
          </form>
        </div>
      )}
      {last ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl">{last.ok ? `Placed ${last.orderId}` : last.message}</h2>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {last.spans.map((span) => (
              <li key={span.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span><span className="text-pine">{span.service}</span> · {span.message}</span>
                <span className="shrink-0 tabular-nums text-muted">{span.status} · {span.ms} ms</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </Shell>
  );
}
