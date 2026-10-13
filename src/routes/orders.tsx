import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { inr } from "@/lib/format";
import { useMesh } from "@/lib/store";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const orders = useMesh((state) => state.orders);
  return (
    <Shell>
      <h1 className="font-display text-4xl">Orders</h1>
      {orders.length === 0 ? (
        <p className="mt-4 text-muted">
          No orders yet. Place one from the cart, or run a sample checkout in the <Link to="/lab" className="text-pine">lab</Link>.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-line bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl">{order.id}</h2>
                <p className="tabular-nums">{inr(order.total)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {order.method.toUpperCase()} · {order.pincode} · {order.etaDays} day via {order.hub}
                {order.couponOff ? ` · STUDIO − ${inr(order.couponOff)}` : ""}
              </p>
              <ul className="mt-3 text-sm">
                {order.lines.map((line) => (
                  <li key={line.productId}>{line.qty} × {line.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
