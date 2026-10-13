import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import composeFile from "../../APP/docker-compose.yml?raw";
import ecsFile from "../../APP/deploy/ecs/main.tf?raw";
import eksFile from "../../APP/deploy/eks/mesh.yaml?raw";
import { Shell } from "@/components/shell";
import { services, type ServiceInfo } from "@/lib/catalog";
import { useMesh } from "@/lib/store";

export const Route = createFileRoute("/lab")({
  component: LabPage,
});

const layers = ["frontend", "edge", "backend", "platform"] as const;

function LabPage() {
  const logs = useMesh((state) => state.logs);
  const sample = useMesh((state) => state.sample);
  const clearLogs = useMesh((state) => state.clearLogs);
  const [selectedId, setSelectedId] = useState("gateway");
  const [tab, setTab] = useState<"compose" | "ecs" | "eks" | "api">("compose");
  const selected = services.find((service) => service.id === selectedId) ?? services[0];

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const span of logs) map.set(span.service, (map.get(span.service) ?? 0) + 1);
    return [...map.entries()].map(([service, requests]) => ({ service, requests }));
  }, [logs]);

  const errors = logs.filter((span) => span.status >= 400).length;
  const avg = logs.length ? Math.round(logs.reduce((sum, span) => sum + span.ms, 0) / logs.length) : 0;
  const traceId = logs[0]?.traceId;
  const waterfall = logs.filter((span) => span.traceId === traceId).slice().reverse();
  const maxMs = Math.max(1, ...waterfall.map((span) => span.ms));

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-pine">Control plane</p>
          <h1 className="font-display text-4xl">Service lab</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => sample()} className="min-h-11 rounded-lg bg-pine px-4 text-paper">Run sample checkout</button>
          <button type="button" onClick={() => clearLogs()} className="min-h-11 rounded-lg border border-line bg-card px-4">Clear log</button>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        This preview runs the saga in the browser so the class can watch it. The Node processes, Compose file, ECS Terraform, and EKS manifests are the same design, one service per process.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Services", String(services.length)],
          ["Spans", String(logs.length)],
          ["Errors", String(errors)],
          ["Avg ms", String(avg)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-card p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-display text-3xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 h-56 rounded-lg border border-line bg-card p-3">
        {counts.length === 0 ? (
          <p className="p-2 text-sm text-muted">No spans yet. Run a sample checkout or add something to the cart.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={counts}>
              <XAxis dataKey="service" tick={{ fill: "var(--color-muted)", fontSize: 12 }} interval={0} angle={-30} height={48} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 12 }} width={28} />
              <Tooltip />
              <Bar dataKey="requests" fill="var(--color-pine)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          {layers.map((layer) => (
            <section key={layer}>
              <h2 className="text-sm tracking-wide text-muted uppercase">{layer}</h2>
              <div className="mt-2 grid gap-2">
                {services.filter((service) => service.layer === layer).map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedId(service.id)}
                    className={`min-h-11 rounded-lg border px-3 text-left ${service.id === selected.id ? "border-pine bg-card" : "border-line bg-card"}`}
                  >
                    <span className="block">{service.name}</span>
                    <span className="text-sm text-muted">{service.port ? `:${service.port}` : service.runtime}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <ServiceDetail service={selected} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Latest trace</h2>
        {waterfall.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Waiting for a request.</p>
        ) : (
          <ol className="mt-3 grid gap-2">
            {waterfall.map((span) => (
              <li key={span.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                <span className={span.status >= 400 ? "text-copper" : "text-pine"}>{span.service}</span>
                <span className="h-2 rounded-full bg-sand">
                  <span className="block h-2 rounded-full bg-pine" style={{ width: `${Math.max(8, (span.ms / maxMs) * 100)}%` }} />
                </span>
                <span className="tabular-nums text-muted">{span.status} · {span.ms} ms</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Request log</h2>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-line bg-ink text-paper">
          {logs.length === 0 ? <p className="p-4 text-sm">stdout is quiet.</p> : (
            <ul className="divide-y divide-line/30 font-mono text-xs">
              {logs.map((span) => (
                <li key={span.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_6rem_1fr_auto]">
                  <span className="text-sand">{new Date(span.at).toISOString().slice(11, 23)}</span>
                  <span>{span.service}</span>
                  <span>{span.message}</span>
                  <span className="tabular-nums">{span.status} {span.ms}ms</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Deploy the same mesh</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            ["compose", "Docker Compose"],
            ["ecs", "ECS"],
            ["eks", "EKS"],
            ["api", "API"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-11 rounded-full px-4 text-sm ${tab === id ? "bg-ink text-paper" : "border border-line bg-card"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "api" ? (
          <ul className="mt-4 grid gap-2">
            {services.filter((service) => service.endpoints.length > 0).map((service) => (
              <li key={service.id} className="rounded-lg border border-line bg-card p-3">
                <p className="text-sm text-pine">{service.name}{service.port ? ` :${service.port}` : ""}</p>
                <ul className="mt-1 font-mono text-sm">
                  {service.endpoints.map((endpoint) => <li key={endpoint}>{endpoint}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-line bg-ink p-4 text-xs text-paper">
            {tab === "compose" ? composeFile : tab === "ecs" ? ecsFile : eksFile}
          </pre>
        )}
      </section>
    </Shell>
  );
}

function ServiceDetail({ service }: { service: ServiceInfo }) {
  return (
    <article className="h-fit rounded-lg border border-line bg-card p-4">
      <p className="text-sm text-muted">{service.runtime}{service.port ? ` · port ${service.port}` : ""}</p>
      <h2 className="font-display text-3xl">{service.name}</h2>
      <p className="mt-2">{service.summary}</p>
      <h3 className="mt-4 text-sm text-muted">Owns</h3>
      <p>{service.owns.join(" · ") || "—"}</p>
      <h3 className="mt-4 text-sm text-muted">Calls</h3>
      <p>{service.calls.join(" · ") || "—"}</p>
      {service.endpoints.length > 0 ? (
        <ul className="mt-4 font-mono text-sm">
          {service.endpoints.map((endpoint) => <li key={endpoint}>{endpoint}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
