import { Link } from "@tanstack/react-router";
import { categoryName, type Product } from "@/lib/catalog";
import { inr, offPercent } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const off = offPercent(product.price, product.mrp);
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-card">
      <Link to="/product/$id" params={{ id: product.id }} className="block bg-sand">
        <img src={product.image} alt={product.name} className="aspect-square w-full object-cover" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm text-muted">{categoryName(product.category)}</p>
        <h2 className="font-display text-xl">
          <Link to="/product/$id" params={{ id: product.id }}>{product.name}</Link>
        </h2>
        <p className="text-sm text-muted">{product.blurb}</p>
        <div className="mt-auto flex items-baseline gap-2 pt-3">
          <span className="text-lg tabular-nums">{inr(product.price)}</span>
          <span className="text-sm text-muted line-through tabular-nums">{inr(product.mrp)}</span>
          {off > 0 ? <span className="text-sm text-copper">{off}% off</span> : null}
        </div>
      </div>
    </article>
  );
}
