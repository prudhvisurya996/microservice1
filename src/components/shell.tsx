import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, ClipboardList, Download, Search, ShoppingBag, Sparkles, Store } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { useMesh } from "@/lib/store";

export function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const count = useMesh((state) => state.cart.reduce((sum, line) => sum + line.qty, 0));
  const [query, setQuery] = useState("");
  const [sourceHref, setSourceHref] = useState("/RelayMart-source.zip");
  const [pdfHref, setPdfHref] = useState("/RelayMart-DevOps-Lifecycle.pdf");

  useEffect(() => {
    useMesh.getState().hydrate();
    document.documentElement.dataset.app = "ready";
    const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
    setSourceHref(`${prefix}/RelayMart-source.zip`);
    setPdfHref(`${prefix}/RelayMart-DevOps-Lifecycle.pdf`);
  }, []);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void navigate({ to: "/", search: { q: query.trim(), cat: "" } });
  }

  const desk = "min-h-11 inline-flex items-center gap-2 px-3 text-sm text-muted hover:text-ink";
  const active = "min-h-11 inline-flex items-center gap-2 px-3 text-sm text-pine";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href={sourceHref}
        download="RelayMart-source.zip"
        className="block bg-pine px-4 py-3 text-center text-sm font-medium text-paper"
      >
        Download source code — RelayMart-source.zip
      </a>
      <a
        href={pdfHref}
        download="RelayMart-DevOps-Lifecycle.pdf"
        className="block bg-ink px-4 py-3 text-center text-sm font-medium text-paper"
      >
        Download DevOps lifecycle PDF
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" search={{ q: "", cat: "" }} className="mr-2 font-display text-2xl leading-none">
            RelayMart
          </Link>
          <nav className="hidden items-center md:flex">
            <Link to="/" search={{ q: "", cat: "" }} className={pathname === "/" ? active : desk}>
              <Store className="size-4" aria-hidden /> Store
            </Link>
            <Link to="/lab" className={pathname === "/lab" ? active : desk}>
              <Activity className="size-4" aria-hidden /> Lab
            </Link>
            <Link to="/assistant" className={pathname === "/assistant" ? active : desk}>
              <Sparkles className="size-4" aria-hidden /> Assistant
            </Link>
            <Link to="/orders" className={pathname === "/orders" ? active : desk}>
              <ClipboardList className="size-4" aria-hidden /> Orders
            </Link>
          </nav>
          <form onSubmit={onSearch} className="ml-auto flex min-w-0 flex-1 items-center gap-2 md:max-w-xs md:flex-none">
            <label className="sr-only" htmlFor="q">Search the catalog</label>
            <input
              id="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the aisle"
              suppressHydrationWarning
              className="min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm"
            />
            <button type="submit" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-ink text-paper" aria-label="Search">
              <Search className="size-4" />
            </button>
          </form>
          <a
            href={sourceHref}
            download="RelayMart-source.zip"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine px-3 text-sm text-paper"
          >
            <Download className="size-4" aria-hidden />
            Download source
          </a>
          <Link to="/cart" className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-card" aria-label="Cart">
            <ShoppingBag className="size-4" />
            {count > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-copper px-1 text-xs text-paper tabular-nums">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:pb-16">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-paper md:hidden">
        <Link to="/" search={{ q: "", cat: "" }} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted">
          <Store className="size-4" aria-hidden /> Store
        </Link>
        <Link to="/lab" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted">
          <Activity className="size-4" aria-hidden /> Lab
        </Link>
        <Link to="/assistant" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted">
          <Sparkles className="size-4" aria-hidden /> Ask
        </Link>
        <Link to="/orders" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted">
          <ClipboardList className="size-4" aria-hidden /> Orders
        </Link>
        <Link to="/cart" className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted">
          <ShoppingBag className="size-4" aria-hidden /> Cart
        </Link>
      </nav>
    </div>
  );
}
