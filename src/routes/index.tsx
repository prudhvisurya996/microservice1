import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/product-card";
import { Shell } from "@/components/shell";
import { categories, products, services } from "@/lib/catalog";
import { useMesh } from "@/lib/store";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    cat: typeof search.cat === "string" ? search.cat : "",
  }),
  component: Home,
});

function Home() {
  const { q, cat } = Route.useSearch();
  const navigate = useNavigate();
  const noteSearch = useMesh((state) => state.noteSearch);
  const seen = useRef("");

  useEffect(() => {
    const query = q.trim();
    if (!query || seen.current === query) return;
    seen.current = query;
    noteSearch(query);
  }, [q, noteSearch]);

  const filtered = products.filter((product) => {
    if (cat && product.category !== cat) return false;
    if (!q.trim()) return true;
    const hay = [product.name, product.blurb, product.category, ...product.tags].join(" ").toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const backend = services.filter((service) => service.layer === "backend").length;

  return (
    <Shell>
      <section className="grid items-end gap-8 border-b border-line pb-8 md:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-sm text-pine">Classroom commerce</p>
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">A marketplace you can open up.</h1>
          <p className="mt-4 max-w-xl text-muted">
            Shop the studio aisle. Every click is a trace: gateway, pricing, inventory, payment.
            The same shape ships as Node processes for Compose, ECS, and EKS.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {[
            ["Frontend", "3"],
            ["API gateway", "1"],
            ["Backend", String(backend)],
            ["Monitoring", "2"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-card p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-display text-3xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => void navigate({ to: "/", search: { q, cat: "" } })}
          className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${cat === "" ? "bg-ink text-paper" : "border border-line bg-card"}`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => void navigate({ to: "/", search: { q, cat: category.id } })}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${cat === category.id ? "bg-ink text-paper" : "border border-line bg-card"}`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-muted">Nothing in the aisle matches that.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      <p className="mt-10 text-sm text-muted">
        Original teaching system. Not affiliated with Flipkart or any retailer. Coupon STUDIO takes ₹100 off from ₹999.
      </p>
    </Shell>
  );
}
