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
    :root { color-scheme: light; --ink:#1c2430; --pine:#1f6b4a; --paper:#f6f1e8; --line:#e4dccb; --card:#fffdf8; }
    * { box-sizing: border-box; }
    body { margin:0; font:16px/1.45 system-ui,sans-serif; background:var(--paper); color:var(--ink); }
    header { position:sticky; top:0; background:#fffdf8; border-bottom:1px solid var(--line); z-index:2; }
    .bar { max-width:1100px; margin:0 auto; display:flex; gap:12px; align-items:center; padding:12px 16px; }
    h1 { font-size:1.4rem; margin:0; cursor:pointer; }
    input, button, textarea, select { font:inherit; }
    input, textarea, select { border:1px solid #d9d0c0; border-radius:8px; padding:10px; background:white; width:100%; }
    button { border:0; border-radius:8px; background:var(--pine); color:white; padding:10px 14px; cursor:pointer; }
    button.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
    button:disabled { opacity:.6; cursor:wait; }
    main { max-width:1100px; margin:0 auto; padding:16px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
    article { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
    article img { width:100%; height:180px; object-fit:cover; background:#efe7da; }
    article div { padding:12px; }
    .price { font-weight:700; }
    .mrp { color:#8a8175; text-decoration:line-through; margin-left:6px; font-weight:400; }
    .panel { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; margin-top:16px; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    label { display:block; font-size:.85rem; margin:8px 0 4px; }
    .note { background:#eef6f1; border-radius:8px; padding:10px; }
    .warn { background:#fff4e5; border-radius:8px; padding:10px; }
    .ok { background:#e7f6ee; border-radius:8px; padding:14px; }
    .hidden { display:none; }
    .pay { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0; }
    .pay label { border:1px solid var(--line); border-radius:8px; padding:8px 10px; margin:0; }
    #qr { width:180px; height:180px; background:white; border:1px solid var(--line); }
    .spin { width:28px; height:28px; border:3px solid #d9d0c0; border-top-color:var(--pine); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:700px) { .row { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <h1 id="home">RelayMart</h1>
      <input id="q" placeholder="Search the shop" style="flex:1">
      <button class="ghost" id="accountBtn">Account</button>
      <button id="cartBtn">Cart <span id="count">0</span></button>
    </div>
  </header>
  <main>
    <div id="grid" class="grid"></div>

    <section id="account" class="panel hidden">
      <h2>Account</h2>
      <div class="row">
        <div>
          <h3>Create account</h3>
          <label>Name</label><input id="name" placeholder="Your name">
          <label>Gmail</label><input id="email" type="email" placeholder="you@gmail.com">
          <label>Indian mobile</label><input id="mobile" inputmode="numeric" placeholder="10 digits, starts 6-9">
          <label>Password</label><input id="password" type="password" placeholder="8+ characters">
          <p><button id="register">Create account</button></p>
          <div id="otpBox" class="hidden">
            <p class="note">Account created. Enter the email code and the mobile code. Both must match before login works.</p>
            <div id="codeNote" class="warn hidden"></div>
            <label>Email code</label><input id="emailCode" inputmode="numeric">
            <label>Mobile code</label><input id="mobileCode" inputmode="numeric">
            <p><button id="verify">Verify codes</button></p>
          </div>
          <div id="msg"></div>
        </div>
        <div>
          <h3>Login</h3>
          <label>Email</label><input id="loginEmail" type="email">
          <label>Password</label><input id="loginPassword" type="password">
          <p><button id="login">Login</button></p>
          <p id="who"></p>
        </div>
      </div>
    </section>

    <section id="cart" class="panel hidden">
      <h2>Cart and delivery</h2>
      <div id="lines"></div>
      <label>Delivery address</label>
      <textarea id="address" rows="3" placeholder="House, street, city"></textarea>
      <label>Pincode</label>
      <input id="pincode" inputmode="numeric" placeholder="6-digit pincode">
      <p>Payment</p>
      <div class="pay">
        <label><input type="radio" name="pay" value="upi" checked> UPI QR</label>
        <label><input type="radio" name="pay" value="card"> Card</label>
        <label><input type="radio" name="pay" value="cod"> Cash on delivery</label>
      </div>
      <div id="qrWrap">
        <p>Scan this QR and then mark the order as paid.</p>
        <svg id="qr" viewBox="0 0 21 21"></svg>
      </div>
      <p><button id="paid">Submit as paid</button></p>
      <div id="loading" class="hidden"><div class="spin"></div><p>Confirming payment and placing the order...</p></div>
      <div id="success" class="ok hidden"></div>
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
    function save() {
      localStorage.setItem("cart", JSON.stringify(cart));
      $("count").textContent = cart.reduce((n, line) => n + line.qty, 0);
    }
    async function api(path, body) {
      const res = await fetch(gateway + path, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({ error: "The backend did not answer. Check port 4000." }));
      if (!res.ok) throw json;
      return json;
    }
    function daysFor(seed) {
      let h = 0;
      const text = String(seed || "guest");
      for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) >>> 0;
      return 2 + (h % 6);
    }
    function drawQr(seed) {
      const n = 21;
      let h = 2166136261;
      for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      const finder = (x, y, ox, oy) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7 && (x === ox || y === oy || x === ox + 6 || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4));
      let rects = "";
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          h = Math.imul(h ^ (x * 31 + y), 16777619) >>> 0;
          const on = finder(x, y, 0, 0) || finder(x, y, 14, 0) || finder(x, y, 0, 14) || h % 3 === 0;
          if (on) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
        }
      }
      $("qr").innerHTML = rects;
    }
    function drawCart() {
      save();
      $("lines").innerHTML = cart.map((line) => "<p>" + line.qty + " × " + line.name + " <b>" + money(line.price * line.qty) + "</b></p>").join("") || "<p>Your cart is empty.</p>";
      const total = cart.reduce((n, line) => n + line.price * line.qty, 0);
      drawQr("upi:" + total + ":" + Date.now());
    }
    function add(product) {
      const line = cart.find((item) => item.id === product.id);
      if (line) line.qty += 1;
      else cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
      drawCart();
      $("cart").classList.remove("hidden");
      $("account").classList.add("hidden");
      $("success").classList.add("hidden");
    }
    async function load() {
      const data = await api("/api/catalog/products");
      const q = val("q").toLowerCase();
      const products = (data.products || []).filter((p) => !q || (p.name + " " + p.blurb).toLowerCase().includes(q));
      $("grid").innerHTML = "";
      products.forEach((p) => {
        const card = document.createElement("article");
        card.innerHTML = "<img alt=''><div><strong></strong><p class='blurb'></p><p class='price'></p><button>Add to cart</button></div>";
        card.querySelector("img").src = p.image;
        card.querySelector("strong").textContent = p.name;
        card.querySelector(".blurb").textContent = p.blurb;
        card.querySelector(".price").innerHTML = money(p.price) + "<span class='mrp'>" + money(p.mrp) + "</span>";
        card.querySelector("button").onclick = () => add(p);
        $("grid").appendChild(card);
      });
    }
    function showCodes(email, mobile) {
      const parts = [];
      if (email && email.code) parts.push("Email code: " + email.code);
      if (mobile && mobile.code) parts.push("Mobile code: " + mobile.code);
      if (!parts.length) {
        $("codeNote").classList.add("hidden");
        return;
      }
      $("codeNote").classList.remove("hidden");
      $("codeNote").textContent = "Gmail or SMS is not configured on the backend, so the code is shown here and verification can still succeed. " + parts.join(". ") + ".";
      if (email && email.code) $("emailCode").value = email.code;
      if (mobile && mobile.code) $("mobileCode").value = mobile.code;
    }
    $("q").oninput = () => load().catch((error) => { $("grid").textContent = error.error || "Could not load the shop."; });
    $("home").onclick = () => { $("account").classList.add("hidden"); $("cart").classList.add("hidden"); };
    $("accountBtn").onclick = () => { $("account").classList.remove("hidden"); $("cart").classList.add("hidden"); };
    $("cartBtn").onclick = () => { drawCart(); $("cart").classList.remove("hidden"); $("account").classList.add("hidden"); };
    document.querySelectorAll("input[name=pay]").forEach((input) => {
      input.onchange = () => $("qrWrap").classList.toggle("hidden", input.value !== "upi" || !input.checked);
    });
    $("register").onclick = async () => {
      $("msg").textContent = "Creating the account...";
      try {
        const created = await api("/api/register", { name: val("name"), email: val("email"), mobile: val("mobile"), password: val("password") });
        const email = await api("/api/verify/email/send", { email: val("email") });
        const mobile = await api("/api/verify/mobile/send", { mobile: val("mobile") });
        $("loginEmail").value = val("email");
        $("loginPassword").value = val("password");
        $("otpBox").classList.remove("hidden");
        showCodes(email, mobile);
        $("msg").textContent = "Account created for " + (created.user && created.user.email ? created.user.email : val("email")) + ". Verify both codes, then login.";
      } catch (error) {
        $("msg").textContent = error.error || "Could not create the account.";
      }
    };
    $("verify").onclick = async () => {
      $("msg").textContent = "Checking codes...";
      try {
        await api("/api/verify/email/confirm", { email: val("email"), code: val("emailCode") });
        await api("/api/verify/mobile/confirm", { mobile: val("mobile"), code: val("mobileCode") });
        const session = await api("/api/login", { email: val("email"), password: val("password") });
        localStorage.setItem("token", session.token || "");
        localStorage.setItem("user", val("email") || val("mobile"));
        $("who").textContent = "Signed in as " + val("email");
        $("msg").textContent = "Email and mobile are verified. You are logged in.";
      } catch (error) {
        $("msg").textContent = error.error || "Verification failed.";
      }
    };
    $("login").onclick = async () => {
      try {
        const session = await api("/api/login", { email: val("loginEmail"), password: val("loginPassword") });
        localStorage.setItem("token", session.token || "");
        localStorage.setItem("user", val("loginEmail"));
        $("who").textContent = "Signed in as " + val("loginEmail");
      } catch (error) {
        $("who").textContent = error.error === "verification_required" ? "Verify email and mobile before login." : (error.error || "Login failed.");
      }
    };
    $("paid").onclick = async () => {
      if (!cart.length) { $("success").classList.remove("hidden"); $("success").textContent = "Add a product before paying."; return; }
      if (val("address").length < 8) { $("success").classList.remove("hidden"); $("success").textContent = "Enter the delivery address."; return; }
      if (!/^\\d{6}$/.test(val("pincode"))) { $("success").classList.remove("hidden"); $("success").textContent = "Enter a 6-digit pincode."; return; }
      if (!localStorage.getItem("token")) { $("account").classList.remove("hidden"); $("who").textContent = "Login before you pay."; return; }
      $("paid").disabled = true;
      $("loading").classList.remove("hidden");
      $("success").classList.add("hidden");
      try {
        const order = await api("/api/checkout", {
          lines: cart.map((line) => ({ productId: line.id, qty: line.qty })),
          method: document.querySelector("input[name=pay]:checked").value,
          pincode: val("pincode"),
          coupon: "STUDIO"
        });
        await new Promise((resolve) => setTimeout(resolve, 1600));
        const who = localStorage.getItem("user") || val("address");
        const days = daysFor(who);
        const when = new Date(Date.now() + days * 86400000).toLocaleDateString("en-IN", { day:"numeric", month:"short" });
        $("loading").classList.add("hidden");
        $("success").classList.remove("hidden");
        const orderId = (order.order && order.order.id) || order.orderId || "placed";
        $("success").textContent = "Order successful. Order " + orderId + ". Delivering to " + val("address") + ", " + val("pincode") + ". It will arrive in " + days + " days, by " + when + ".";
        cart.splice(0, cart.length);
        save();
        $("lines").innerHTML = "<p>Your cart is empty.</p>";
      } catch (error) {
        $("loading").classList.add("hidden");
        $("success").classList.remove("hidden");
        $("success").textContent = error.error || "Payment was recorded, but the order did not complete.";
      } finally {
        $("paid").disabled = false;
      }
    };
    save();
    load().catch((error) => { $("grid").textContent = error.error || "Could not load the shop. The backend must be reachable on port 4000."; });
    if (localStorage.getItem("user")) $("who").textContent = "Signed in as " + localStorage.getItem("user");
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
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "public, max-age=86400" });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page);
});

server.listen(port, () => {
  process.stdout.write(JSON.stringify({ service: "frontend", port, gateway }) + "\n");
});
