import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Shell } from "@/components/shell";
import { productById } from "@/lib/catalog";
import { askAssistant } from "@/lib/ai.functions";
import { rankProducts } from "@/lib/rank";
import { useMesh } from "@/lib/store";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
});

const prompts = [
  "A quiet setup for studying",
  "Something warm to wear",
  "A gift under 3000",
];

function AssistantPage() {
  const noteRecommend = useMesh((state) => state.noteRecommend);
  const [prompt, setPrompt] = useState(prompts[0]);
  const [asked, setAsked] = useState("");
  const [pending, setPending] = useState(false);
  const [model, setModel] = useState("");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const ranked = asked ? rankProducts(asked) : [];
  const picked = modelIds.flatMap((id) => {
    const product = productById(id);
    return product ? [product] : [];
  });

  async function ask(next: string) {
    const text = next.trim();
    if (text.length < 2 || pending) return;
    setAsked(text);
    setPending(true);
    setError("");
    setModel("");
    setModelIds([]);
    noteRecommend(text);
    try {
      const result = await askAssistant({ data: { prompt: text } });
      if (!result.ok) setError(result.error);
      else {
        setModel(result.text);
        setModelIds(result.productIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ask");
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell>
      <p className="text-sm text-pine">Recommendation service + Grok</p>
      <h1 className="mt-2 font-display text-4xl">Ask the aisle.</h1>
      <p className="mt-3 max-w-xl text-muted">
        The ranker answers immediately from the catalog. Grok is a separate call, only when you press the button, and the key stays on the server.
      </p>
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(prompt);
        }}
      >
        <label className="sr-only" htmlFor="ask">Question</label>
        <input
          id="ask"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={300}
          className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3"
        />
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-pine px-5 text-paper disabled:opacity-40">
          {pending ? "Asking…" : "Ask Grok"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((item) => (
          <button key={item} type="button" className="min-h-11 rounded-full border border-line bg-card px-4 text-sm" onClick={() => { setPrompt(item); void ask(item); }}>
            {item}
          </button>
        ))}
      </div>
      {ranked.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Recommendation service</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ranked.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}
      {model ? (
        <section className="mt-8 max-w-2xl rounded-lg border border-line bg-card p-4">
          <h2 className="font-display text-2xl">Grok</h2>
          <p className="mt-2">{model}</p>
        </section>
      ) : null}
      {picked.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picked.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-copper">{error}</p> : null}
    </Shell>
  );
}
