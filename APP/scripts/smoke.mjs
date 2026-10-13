import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kids = [];

const services = [
  ["services/catalog/server.js", 4001, "catalog"],
  ["services/search/server.js", 4002, "search"],
  ["services/pricing/server.js", 4003, "pricing"],
  ["services/inventory/server.js", 4004, "inventory"],
  ["services/cart/server.js", 4005, "cart"],
  ["services/order/server.js", 4006, "order"],
  ["services/payment/server.js", 4007, "payment"],
  ["services/shipping/server.js", 4008, "shipping"],
  ["services/review/server.js", 4009, "review"],
  ["services/user/server.js", 4010, "user"],
  ["services/notification/server.js", 4011, "notification"],
  ["services/recommendation/server.js", 4012, "recommendation"],
  ["gateway/server.js", 4000, "gateway"],
];

function start(entry, port, name) {
  const child = spawn(process.execPath, [join(root, entry)], {
    cwd: root,
    env: { ...process.env, PORT: String(port), SERVICE_NAME: name },
    stdio: ["ignore", "pipe", "pipe"],
  });
  kids.push(child);
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
}

async function wait(url) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`timeout ${url}`);
}

function stop() {
  for (const child of kids) child.kill();
}

try {
  for (const [entry, port, name] of services) start(entry, port, name);
  await wait("http://127.0.0.1:4000/health");
  await wait("http://127.0.0.1:4004/health");

  const placed = await fetch("http://127.0.0.1:4000/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lines: [{ productId: "meadow-tee", qty: 1 }],
      method: "upi",
      pincode: "560001",
      coupon: "STUDIO",
    }),
  });
  const placedBody = await placed.json();
  if (placed.status !== 201) throw new Error(`checkout ${placed.status} ${JSON.stringify(placedBody)}`);
  if (!placedBody.order?.id) throw new Error("missing order id");
  if (placedBody.priced.couponOff !== 100) throw new Error("coupon not applied");

  const before = await (await fetch("http://127.0.0.1:4004/stock/fieldline-14")).json();
  const declined = await fetch("http://127.0.0.1:4000/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lines: [{ productId: "fieldline-14", qty: 1 }],
      method: "card",
      pincode: "560001",
      forceFail: true,
    }),
  });
  if (declined.status !== 402) throw new Error(`expected 402, got ${declined.status}`);
  const after = await (await fetch("http://127.0.0.1:4004/stock/fieldline-14")).json();
  if (before.available !== after.available) throw new Error("reservation was not released");

  const search = await (await fetch("http://127.0.0.1:4000/api/search?q=kettle")).json();
  if (!search.products?.some((product) => product.id === "cinder-kettle")) throw new Error("search missed kettle");

  console.log(`ok ${placedBody.order.id} trace=${placedBody.trace.length} hops`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  stop();
  setTimeout(() => process.exit(process.exitCode || 0), 200);
}
