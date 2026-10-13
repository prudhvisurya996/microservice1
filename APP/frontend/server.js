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
    header { background:#fffdf8; border-bottom:1px solid var(--line); }
    .bar { max-width:980px; margin:0 auto; display:flex; gap:12px; align-items:center; padding:14px 16px; }
    h1 { margin:0; font-size:1.45rem; }
    button, input, textarea { font:inherit; }
    input, textarea { width:100%; border:1px solid #d9d0c0; border-radius:8px; padding:10px; background:white; }
    button { border:0; border-radius:8px; background:var(--pine); color:white; padding:10px 14px; cursor:pointer; }
    button.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
    button:disabled { opacity:.55; cursor:wait; }
    main { max-width:980px; margin:0 auto; padding:20px 16px 48px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px; max-width:460px; margin:24px auto; }
    .wide { max-width:980px; }
    label { display:block; font-size:.85rem; margin:10px 0 4px; }
    .pair { display: flex; gap: 8px; align-items: center; }
    .pair input { flex: 1; }
    .pair button { white-space: nowrap; }
    .hint { font-size:.9rem; color:#3d4a3f; background:#eef6f1; border-radius:8px; padding:8px 10px; margin-top:6px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
    article { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; cursor:pointer; }
    article img, .hero img { width:100%; height:200px; object-fit:cover; background:#efe7da; }
    article div, .hero div { padding:12px; }
    .price { font-weight:700; }
    .mrp { color:#8a8175; text-decoration:line-through; margin-left:6px; font-weight:400; }
    .hidden { display:none !important; }
    .ok { background:#e7f6ee; border-radius:12px; padding:14px; }
    .bad { background:#fdecec; border-radius:12px; padding:10px; }
    #qr { width:190px; height:190px; background:white; border:1px solid var(--line); }
    .spin { width:28px; height:28px; border:3px solid #d9d0c0; border-top-color:var(--pine); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <h1>RelayMart</h1>
      <span id="hello" style="flex:1"></span>
      <button class="ghost hidden" id="logout">Logout</button>
      <button class="ghost hidden" id="toProducts">Products</button>
    </div>
  </header>
  <main>
    <section id="screen-register" class="card">
      <h2>Create account</h2>
      <p>Send the code beside Gmail and beside the mobile number. The code box opens only after you click send.</p>
      <label>Name</label><input id="name">
      <label>Gmail</label>
      <div class="pair">
        <input id="email" type="email" placeholder="you@gmail.com">
        <button id="sendEmail" type="button">Send code</button>
      </div>
      <div id="emailBox" class="hidden">
        <label>Email verification code</label><input id="emailCode" inputmode="numeric" placeholder="Enter the email code">
        <div id="emailHint" class="hint"></div>
      </div>
      <label>Mobile number</label>
      <div class="pair">
        <input id="mobile" inputmode="numeric" placeholder="10-digit Indian number">
        <button id="sendMobile" type="button">Send code</button>
      </div>
      <div id="mobileBox" class="hidden">
        <label>Mobile verification code</label><input id="mobileCode" inputmode="numeric" placeholder="Enter the mobile code">
        <div id="mobileHint" class="hint"></div>
      </div>
      <label>Password</label><input id="password" type="password" placeholder="8+ characters">
      <label>Confirm password</label><input id="confirmPassword" type="password" placeholder="Repeat the password">
      <p><button id="finishRegister">Create account</button></p>
      <div id="regMsg"></div>
    </section>

    <section id="screen-login" class="card hidden">
      <h2>Login</h2>
      <label>Email</label><input id="loginEmail" type="email">
      <label>Password</label><input id="loginPassword" type="password">
      <p><button id="login">Login</button></p>
      <p><button class="ghost" id="backRegister">Create another account</button></p>
      <div id="loginMsg"></div>
    </section>

    <section id="screen-products" class="hidden">
      <h2>Products</h2>
      <input id="q" placeholder="Search">
      <div id="grid" class="grid" style="margin-top:14px"></div>
    </section>

    <section id="screen-product" class="card wide hidden">
      <button class="ghost" id="backProducts">Back to products</button>
      <div class="hero" id="detail"></div>
      <p><button id="add">Add to cart</button></p>
    </section>

    <section id="screen-cart" class="card wide hidden">
      <button class="ghost" id="backShop">Continue shopping</button>
      <h2>Cart</h2>
      <div id="lines"></div>
      <h3>Delivery address</h3>
      <label>Address</label><textarea id="address" rows="3" placeholder="House, street, city"></textarea>
      <label>Pincode</label><input id="pincode" inputmode="numeric" placeholder="6 digits">
      <p><button id="toPay" class="ghost">Continue to payment</button></p>
      <div id="payBox" class="hidden">
        <h3>Payment</h3>
        <p>This QR is not a real payment. Scan is only for the demonstration.</p>
        <svg id="qr" viewBox="0 0 21 21"></svg>
        <p><button id="paid">I have paid</button></p>
        <div id="loading" class="hidden"><div class="spin"></div><p>Waiting for the backend...</p></div>
      </div>
      <div id="result"></div>
    </section>
  </main>
  <script>
    let gateway = ${JSON.stringify(gateway)};
    if (!["localhost","127.0.0.1"].includes(location.hostname) && /127\\.0\\.0\\.1|localhost/.test(gateway)) {
      gateway = location.protocol + "//" + location.hostname + ":4000";
    }
    const $ = (id) => document.getElementById(id);
    const val = (id) => $(id).value.trim();
    const money = (n) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n);
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    let products = [];
    let current = null;
    const screens = ["register","login","products","product","cart"];
    function show(name) {
      screens.forEach((id) => $("screen-" + id).classList.toggle("hidden", id !== name));
      const signedIn = Boolean(localStorage.getItem("token"));
      $("logout").classList.toggle("hidden", !signedIn);
      $("toProducts").classList.toggle("hidden", !signedIn || name === "products");
      $("hello").textContent = signedIn ? localStorage.getItem("email") : "";
    }
    function saveCart() { localStorage.setItem("cart", JSON.stringify(cart)); }
    async function api(path, body) {
      const res = await fetch(gateway + path, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({ error: "Backend did not answer on port 4000." }));
      if (!res.ok) throw json;
      return json;
    }
    function drawQr(seed) {
      const n = 21;
      let h = 2166136261;
      for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      const finder = (x, y, ox, oy) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7 && (x === ox || y === oy || x === ox + 6 || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4));
      let rects = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        h = Math.imul(h ^ (x * 31 + y), 16777619) >>> 0;
        if (finder(x, y, 0, 0) || finder(x, y, 14, 0) || finder(x, y, 0, 14) || h % 3 === 0) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      }
      $("qr").innerHTML = rects;
    }
    function paintProducts() {
      const q = val("q").toLowerCase();
      $("grid").innerHTML = "";
      products.filter((p) => !q || (p.name + " " + p.blurb).toLowerCase().includes(q)).forEach((p) => {
        const card = document.createElement("article");
        card.innerHTML = "<img alt=''><div><strong></strong><p></p><p class='price'></p></div>";
        card.querySelector("img").src = p.image;
        card.querySelector("strong").textContent = p.name;
        card.querySelector("p").textContent = p.blurb;
        card.querySelector(".price").innerHTML = money(p.price) + "<span class='mrp'>" + money(p.mrp) + "</span>";
        card.onclick = () => openProduct(p.id);
        $("grid").appendChild(card);
      });
    }
    function openProduct(id) {
      current = products.find((p) => p.id === id);
      if (!current) return;
      $("detail").innerHTML = "<img alt=''><div><h2></h2><p class='blurb'></p><p class='price'></p></div>";
      $("detail").querySelector("img").src = current.image;
      $("detail").querySelector("h2").textContent = current.name;
      $("detail").querySelector(".blurb").textContent = current.blurb;
      $("detail").querySelector(".price").innerHTML = money(current.price) + "<span class='mrp'>" + money(current.mrp) + "</span>";
      show("product");
    }
    function paintCart() {
      saveCart();
      $("lines").innerHTML = cart.map((line) => "<p>" + line.qty + " × " + line.name + " — <b>" + money(line.price * line.qty) + "</b></p>").join("") || "<p>Your cart is empty.</p>";
    }
    async function openProducts() {
      if (!localStorage.getItem("token")) { show("login"); return; }
      if (!products.length) {
        const data = await api("/api/catalog/products");
        products = data.products || [];
      }
      paintProducts();
      show("products");
    }
    let emailSent = false;
    let mobileSent = false;
    async function ensureAccount() {
      if (val("password") !== val("confirmPassword")) {
        throw { error: "Password and confirm password do not match." };
      }
      try {
        await api("/api/register", { name: val("name"), email: val("email"), mobile: val("mobile"), password: val("password") });
      } catch (error) {
        if (error.error !== "email_or_mobile_taken") throw error;
      }
    }
    $("sendEmail").onclick = async () => {
      $("regMsg").className = "";
      $("regMsg").textContent = "Sending the email code...";
      try {
        await ensureAccount();
        const email = await api("/api/verify/email/send", { email: val("email") });
        emailSent = true;
        $("emailBox").classList.remove("hidden");
        $("emailHint").textContent = email.code ? "Email code: " + email.code : "Code sent to Gmail.";
        $("regMsg").textContent = "Enter the email code.";
      } catch (error) {
        $("regMsg").className = "bad";
        $("regMsg").textContent = error.error || "Could not send the email code.";
      }
    };
    $("sendMobile").onclick = async () => {
      $("regMsg").className = "";
      $("regMsg").textContent = "Sending the mobile code...";
      try {
        await ensureAccount();
        const mobile = await api("/api/verify/mobile/send", { mobile: val("mobile") });
        mobileSent = true;
        $("mobileBox").classList.remove("hidden");
        $("mobileHint").textContent = mobile.code ? "Mobile code: " + mobile.code : "Code sent to the mobile number.";
        $("regMsg").textContent = "Enter the mobile code.";
      } catch (error) {
        $("regMsg").className = "bad";
        $("regMsg").textContent = error.error || "Could not send the mobile code.";
      }
    };
    $("finishRegister").onclick = async () => {
      if (!emailSent || !mobileSent) { $("regMsg").textContent = "Send both codes first."; return; }
      if (val("password") !== val("confirmPassword")) { $("regMsg").textContent = "Password and confirm password do not match."; return; }
      $("regMsg").textContent = "Checking the codes...";
      try {
        await api("/api/verify/email/confirm", { email: val("email"), code: val("emailCode") });
        await api("/api/verify/mobile/confirm", { mobile: val("mobile"), code: val("mobileCode") });
        $("loginEmail").value = val("email");
        $("loginPassword").value = "";
        $("loginMsg").textContent = "Registration complete. Login with the same email and password.";
        show("login");
      } catch (error) {
        $("regMsg").className = "bad";
        $("regMsg").textContent = error.error || "The codes did not match.";
      }
    };
    $("login").onclick = async () => {
      $("loginMsg").textContent = "";
      try {
        const session = await api("/api/login", { email: val("loginEmail"), password: val("loginPassword") });
        localStorage.setItem("token", session.token || "ok");
        localStorage.setItem("email", val("loginEmail"));
        await openProducts();
      } catch (error) {
        $("loginMsg").className = "bad";
        $("loginMsg").textContent = error.error === "verification_required" ? "Verify email and mobile during registration first." : (error.error || "Login failed.");
      }
    };
    $("backRegister").onclick = () => show("register");
    $("logout").onclick = async () => {
      const email = localStorage.getItem("email") || "";
      try { await api("/api/logout", { email }); } catch (error) {}
      localStorage.removeItem("token");
      localStorage.removeItem("email");
      show("login");
    };
    $("toProducts").onclick = () => openProducts().catch((error) => alert(error.error || "Could not load products"));
    $("q").oninput = paintProducts;
    $("backProducts").onclick = () => show("products");
    $("backShop").onclick = () => show("products");
    $("add").onclick = () => {
      if (!current) return;
      const line = cart.find((item) => item.id === current.id);
      if (line) line.qty += 1; else cart.push({ id: current.id, name: current.name, price: current.price, qty: 1 });
      paintCart();
      $("payBox").classList.add("hidden");
      $("result").textContent = "";
      show("cart");
    };
    $("toPay").onclick = () => {
      if (!cart.length) { $("result").textContent = "Add a product first."; return; }
      if (val("address").length < 8) { $("result").textContent = "Enter the delivery address before payment."; return; }
      if (!/^\\d{6}$/.test(val("pincode"))) { $("result").textContent = "Enter a 6-digit pincode."; return; }
      const total = cart.reduce((n, line) => n + line.price * line.qty, 0);
      drawQr("upi|" + val("pincode") + "|" + total);
      $("payBox").classList.remove("hidden");
      $("result").textContent = "";
    };
    $("paid").onclick = async () => {
      $("paid").disabled = true;
      $("loading").classList.remove("hidden");
      $("result").textContent = "";
      try {
        const order = await api("/api/checkout", {
          email: localStorage.getItem("email"),
          lines: cart.map((line) => ({ productId: line.id, qty: line.qty })),
          method: "upi",
          pincode: val("pincode"),
          address: val("address"),
          coupon: "STUDIO"
        });
        await new Promise((resolve) => setTimeout(resolve, 900));
        $("loading").classList.add("hidden");
        const id = order.order && order.order.id;
        $("result").className = "ok";
        $("result").innerHTML = "<p>" + (order.message || "Order placed successful") + "</p>" + (id ? "<p><button id='cancel'>Cancel order</button></p>" : "");
        const cancel = $("cancel");
        if (cancel) cancel.onclick = async () => {
          cancel.disabled = true;
          try {
            const done = await api("/api/orders/" + id + "/cancel", { email: localStorage.getItem("email") || "" });
            $("result").textContent = done.message || "Order cancelled";
            cart.splice(0, cart.length);
            saveCart();
            paintCart();
          } catch (error) {
            $("result").textContent = error.error || "Could not cancel the order.";
          }
        };
        cart.splice(0, cart.length);
        saveCart();
        paintCart();
      } catch (error) {
        $("loading").classList.add("hidden");
        $("result").className = "bad";
        $("result").textContent = error.error || "The backend did not place the order.";
      } finally {
        $("paid").disabled = false;
      }
    };
    if (localStorage.getItem("token")) openProducts().catch(() => show("login"));
    else show("register");
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
