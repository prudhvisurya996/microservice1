import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { categoryName, productById } from "@/lib/catalog";
import { inr, offPercent } from "@/lib/format";
import { etaFor } from "@/lib/mesh";
import { useMesh } from "@/lib/store";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const product = productById(id);
  const add = useMesh((state) => state.add);
  const noteView = useMesh((state) => state.noteView);
  const available = useMesh((state) => state.available(id));
  const [pin, setPin] = useState("560001");
  const [eta, setEta] = useState<string>("");

  useEffect(() => {
    if (product) noteView(product.id);
  }, [product, noteView]);

  if (!product) {
    return (
      <Shell>
        <h1 className="font-display text-3xl">That product is not in the fixture.</h1>
        <Link to="/" search={{ q: "", cat: "" }} className="mt-4 inline-flex min-h-11 items-center text-pine">
          Back to the aisle
        </Link>
      </Shell>
    );
  }

  const off = offPercent(product.price, product.mrp);

  return (
    <Shell>
      <div className="grid gap-8 md:grid-cols-2">
        <img src={product.image} alt={product.name} className="w-full rounded-lg border border-line bg-sand object-cover" />
        <div>
          <p className="text-sm text-muted">{categoryName(product.category)} · Lane Assured</p>
          <h1 className="mt-2 font-display text-4xl">{product.name}</h1>
          <p className="mt-3 text-muted">{product.blurb}</p>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl tabular-nums">{inr(product.price)}</span>
            <span className="text-muted line-through tabular-nums">{inr(product.mrp)}</span>
            {off > 0 ? <span className="text-copper">{off}% off</span> : null}
          </div>
          <p className="mt-2 text-sm text-muted">Inclusive of GST · {product.rating} from {product.reviewCount} reviews · {available} in stock</p>
          {product.offer ? <p className="mt-2 text-sm text-pine">{product.offer}</p> : null}
          <button
            type="button"
            disabled={available < 1}
            onClick={() => add(product.id)}
            className="mt-6 min-h-11 rounded-lg bg-pine px-5 text-paper disabled:opacity-40"
          >
            {available < 1 ? "Out of stock" : "Add to cart"}
          </button>
          <form
            className="mt-6 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const next = etaFor(pin.trim());
              setEta(next ? `${next.days} day via ${next.hub}` : "Use a 6-digit pincode");
            }}
          >
            <label className="text-sm text-muted">
              Pincode
              <input value={pin} onChange={(event) => setPin(event.target.value)} className="mt-1 block min-h-11 w-36 rounded-lg border border-line bg-card px-3" />
            </label>
            <button type="submit" className="min-h-11 rounded-lg border border-line bg-card px-4">Check delivery</button>
            {eta ? <p className="text-sm">{eta}</p> : null}
          </form>
          <ul className="mt-6 grid gap-2 text-sm">
            {product.specs.map((spec) => (
              <li key={spec} className="border-b border-line py-2">{spec}</li>
            ))}
          </ul>
        </div>
      </div>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Reviews</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {product.reviews.map((review) => (
            <blockquote key={review.author} className="rounded-lg border border-line bg-card p-4">
              <p>{review.text}</p>
              <footer className="mt-2 text-sm text-muted">{review.author} · {review.stars} / 5</footer>
            </blockquote>
          ))}
        </div>
      </section>
    </Shell>
  );
}
