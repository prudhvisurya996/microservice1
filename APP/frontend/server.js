import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const gateway = process.env.GATEWAY_PUBLIC_URL || "http://127.0.0.1:4000";
const here = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RelayMart</title>
  <style>
    :root { color-scheme: light; --ink:#1c2430; --pine:#1f6b4a; --paper:#f4efe6; --line:#e4dccb; --card:#fffdf8; }
    * { box-sizing: border-box; }
    body { margin:0; font:16px/1.45 system-ui,sans-serif; background:var(--paper); color:var(--ink); }
    header { position:sticky; top:0; background:#fffdf8; border-bottom:1px solid var(--line); z-index:2; }
    .bar { max-width:1100px; margin:0 auto; display:flex; gap:12px; align-items:center; padding:12px 16px; }
    h1 { font-size:1.4rem; margin:0; }
    input, button, select { font:inherit; min-height:42px; }
    input, select { border:1px solid #d9d0c0; border-radius:8px; padding:0 10px; background:white; }
    button { border:0; border-radius:8px; background:var(--pine); color:white; padding:0 14px; cursor:pointer; }
    button.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
    main { max-width:1100px; margin:0 auto; padding:16px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
    article { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
    article img { width:100%; height:180px; object-fit:cover; background:#efe7da; }
    article div { padding:12px; }
    .price { font-weight:700; }
    .mrp { color:#8a8175; text-decoration:line-through; margin-left:6px; font-weight:400; }
    .drawer { position:fixed; inset:0 0 0 auto; width:min(420px,100%); background:var(--card); border-left:1px solid var(--line); padding:16px; overflow:auto; box-shadow:-8px 0 30px rgba(0,0,0,.08); }
    .hidden { display:none; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    label { display:block; font-size:.85rem; margin:8px 0 4px; }
    .msg { background:#17202a; color:#e7eef6; border-radius:8px; padding:10px; white-space:pre-wrap; }
    .top { display:flex; justify-content:space-between; align-items:center; }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <h1>RelayMart</h1>
      <input id="q" placeholder="Search the shop" style="flex:1">
      <button class="ghost" id="accountBtn">Account</button>
      <button id="cartBtn">Cart <span id="count">0</span></button>
    </div>
  </header>
  <main>
    <div id="grid" class="grid"></div>
    <section id="account" class="drawer hidden">
      <div class="top"><h2>Account</h2><button class="ghost" id="closeAccount">Close</button></div>
      <p>Register with your email and an Indian mobile. The code is sent to that inbox and to +91.</p>
      <div class="row">
        <div><label>Name</label><input id="name" placeholder="Your name"></div>
        <div><label>Email</label><input id="email" type="email" placeholder="you@gmail.com"></div>
        <div><label>Mobile</label><input id="mobile" inputmode="numeric" placeholder="10-digit Indian number"></div>
        <div><label>Password</label><input id="password" type="password" placeholder="8+ characters"></div>
      </div>
      <button id="register">Create account</button>
      <label>Email code</label><input id="emailCode" inputmode="numeric">
      <button id="sendEmail">Send email code</button>
      <button id="confirmEmail">Confirm email</button>
      <label>Mobile code</label><input id="mobileCode" inputmode="numeric">
      <button id="sendMobile">Send mobile code</button>
      <button id="confirmMobile">Confirm mobile</button>
      <button id="login">Login</button>
      <p id="who"></p>
      <div class="msg" id="msg">Sign in to check out.</div>
    </section>
    <section id="cart" class="drawer hidden">
      <div class="top"><h2>Cart</h2><button class="ghost" id="closeCart">Close</button></div>
      <div id="lines"></div>
      <label>Pincode</label><input id="pincode" value="560001">
      <button id="checkout">Place order</button>
      <label>Track order</label><input id="orderId" placeholder="ord_...">
      <button id="ship">Create shipment</button>
      <button id="refreshTrack">Refresh tracking</button>
      <div class="msg" id="track">No shipment yet.</div>
    </section>
  </main>
  <script>
    let gateway = ${JSON.stringify(gateway)};
    if (!["localhost","127.0.0.1"].includes(location.hostname) && /127\\.0\\.0\\.1|localhost/.test(gateway)) {
      gateway = location.protocol + "//" + location.hostname + ":4000";
    }
    const money = (n) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n);
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const $ = (id) => document.getElementById(id);
    const val = (id) => $(id).value.trim();
    function save() { localStorage.setItem("cart", JSON.stringify(cart)); $("count").textContent = cart.reduce((n,l)=>n+l.qty,0); }
    function say(el, data) { el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2); }
    async function api(path, body) {
      const res = await fetch(gateway + path, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({ error: "The API did not answer. Open port 4000 on the backend server." }));
      if (!res.ok) throw json;
      return json;
    }
    function drawCart() {
      save();
      $("lines").innerHTML = cart.map((line) => "<p>" + line.qty + " × " + line.name + " <b>" + money(line.price * line.qty) + "</b></p>").join("") || "<p>Your cart is empty.</p>";
    }
    function add(product) {
      const line = cart.find((item) => item.id === product.id);
      if (line) line.qty += 1; else cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
      drawCart();
      $("cart").classList.remove("hidden");
    }
    async function load() {
      const data = await api("/api/catalog/products");
      const q = val("q").toLowerCase();
      const products = (data.products || []).filter((p) => !q || (p.name + " " + p.blurb).toLowerCase().includes(q));
      $("grid").innerHTML = products.map((p) => \`
        <article>
          <img src="\${p.image}" alt="">
          <div>
            <strong>\${p.name}</strong>
            <p>\${p.blurb}</p>
            <p class="price">\${money(p.price)}<span class="mrp">\${money(p.mrp)}</span></p>
            <button data-id="\${p.id}">Add to cart</button>
          </div>
        </article>\`).join("");
      $("grid").querySelectorAll("button").forEach((button) => {
        button.onclick = () => add(products.find((p) => p.id === button.dataset.id));
      });
    }
    $("q").oninput = () => load().catch((error) => { $("grid").textContent = error.error || "Could not load the shop."; });
    $("accountBtn").onclick = () => { $("account").classList.remove("hidden"); $("cart").classList.add("hidden"); };
    $("cartBtn").onclick = () => { drawCart(); $("cart").classList.remove("hidden"); $("account").classList.add("hidden"); };
    $("closeAccount").onclick = () => $("account").classList.add("hidden");
    $("closeCart").onclick = () => $("cart").classList.add("hidden");
    $("register").onclick = async () => {
      try {
        const created = await api("/api/register", { name: val("name"), email: val("email"), mobile: val("mobile"), password: val("password") });
        const email = await api("/api/verify/email/send", { email: val("email") });
        const mobile = await api("/api/verify/mobile/send", { mobile: val("mobile") });
        say($("msg"), { created, email, mobile });
      } catch (error) { say($("msg"), error); }
    };
    $("sendEmail").onclick = () => api("/api/verify/email/send", { email: val("email") }).then((d) => say($("msg"), d)).catch((e) => say($("msg"), e));
    $("confirmEmail").onclick = () => api("/api/verify/email/confirm", { email: val("email"), code: val("emailCode") }).then((d) => say($("msg"), d)).catch((e) => say($("msg"), e));
    $("sendMobile").onclick = () => api("/api/verify/mobile/send", { mobile: val("mobile") }).then((d) => say($("msg"), d)).catch((e) => say($("msg"), e));
    $("confirmMobile").onclick = () => api("/api/verify/mobile/confirm", { mobile: val("mobile"), code: val("mobileCode") }).then((d) => say($("msg"), d)).catch((e) => say($("msg"), e));
    $("login").onclick = () => api("/api/login", { email: val("email"), password: val("password") }).then((d) => { localStorage.setItem("token", d.token || ""); $("who").textContent = "Signed in as " + val("email"); say($("msg"), d); }).catch((e) => say($("msg"), e));
    $("checkout").onclick = () => api("/api/checkout", {
      lines: cart.map((line) => ({ productId: line.id, qty: line.qty })),
      method: "upi", pincode: val("pincode"), coupon: "STUDIO"
    }).then((order) => { $("orderId").value = order.orderId || order.id || ""; say($("track"), order); cart.splice(0, cart.length); drawCart(); }).catch((e) => say($("track"), e));
    let shipmentId = "";
    $("ship").onclick = () => api("/api/tracking/shipments", { orderId: val("orderId"), pincode: val("pincode") }).then((d) => { shipmentId = d.id; say($("track"), d); }).catch((e) => say($("track"), e));
    $("refreshTrack").onclick = () => {
      if (!shipmentId) return say($("track"), "Create a shipment first");
      api("/api/tracking/shipments/" + shipmentId).then((d) => say($("track"), d)).catch((e) => say($("track"), e));
    };
    drawCart();
    load().catch((error) => { $("grid").textContent = error.error || "Could not load the shop. The gateway must be reachable on port 4000."; });
    if (localStorage.getItem("token")) $("who").textContent = "Session saved on this browser.";
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "frontend" }));
    return;
  }
  if (url.pathname.startsWith("/products/")) {
    const name = url.pathname.slice("/products/".length);
    if (!name || name.includes("/") || name.includes("..")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const file = join(here, "products", name);
    try {
      await access(file);
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page);
});

server.listen(port, () => {
  process.stdout.write(JSON.stringify({ service: "frontend", port, gateway }) + "\n");
});
