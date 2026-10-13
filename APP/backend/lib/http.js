import http from "node:http";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function match(pattern, pathname) {
  const expected = pattern.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i].startsWith(":")) params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

export function start({ name, routes, cors = false }) {
  const port = Number(process.env.PORT || 4000);
  const totals = new Map();
  let durationSum = 0;
  let durationCount = 0;

  function record(method, status, ms) {
    const key = `${method}|${status}`;
    totals.set(key, (totals.get(key) || 0) + 1);
    durationSum += ms;
    durationCount += 1;
  }

  function metrics() {
    const lines = [
      "# HELP http_requests_total Count of HTTP requests.",
      "# TYPE http_requests_total counter",
    ];
    for (const [key, value] of totals) {
      const [method, status] = key.split("|");
      lines.push(`http_requests_total{service="${name}",method="${method}",status="${status}"} ${value}`);
    }
    lines.push("# TYPE http_request_duration_ms_sum counter");
    lines.push(`http_request_duration_ms_sum{service="${name}"} ${durationSum.toFixed(1)}`);
    lines.push("# TYPE http_request_duration_ms_count counter");
    lines.push(`http_request_duration_ms_count{service="${name}"} ${durationCount}`);
    return `${lines.join("\n")}\n`;
  }

  const server = http.createServer(async (req, res) => {
    const started = performance.now();
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (cors) {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "content-type");
      res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const log = (status) => {
      const ms = performance.now() - started;
      if (url.pathname === "/health" || url.pathname === "/metrics") return;
      record(req.method || "GET", status, ms);
      process.stdout.write(
        `${JSON.stringify({
          ts: new Date().toISOString(),
          level: status >= 500 ? "error" : "info",
          service: name,
          method: req.method,
          path: url.pathname,
          status,
          ms: Math.round(ms),
        })}\n`,
      );
    };

    try {
      if (url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: name }));
        return;
      }
      if (url.pathname === "/metrics") {
        res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
        res.end(metrics());
        return;
      }

      let body = {};
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        try {
          body = await readBody(req);
        } catch (error) {
          log(400);
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "bad request" }));
          return;
        }
      }

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const params = match(route.path, url.pathname);
        if (!params) continue;
        const result = await route.handler({ params, query: url.searchParams, body });
        const status = result.status || 200;
        log(status);
        if (result.contentType && typeof result.body === "string") {
          res.writeHead(status, { "content-type": result.contentType });
          res.end(result.body);
          return;
        }
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(result.body ?? {}));
        return;
      }

      log(404);
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", service: name }));
    } catch (error) {
      log(500);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal", message: error instanceof Error ? error.message : "error" }));
    }
  });

  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level: "info", service: name, msg: "listening", port })}\n`,
    );
  });
  return server;
}
