import { start } from "../lib/http.js";

const gateway = process.env.GATEWAY_PUBLIC_URL || "http://127.0.0.1:4000";

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RelayMart</title>
  <style>
    body { font: 16px/1.45 system-ui, sans-serif; margin: 0; background: #f4efe6; color: #1c2430; }
    header, main { max-width: 880px; margin: 0 auto; padding: 1rem; }
    h1 { font-size: 1.6rem; margin: 0; }
    section { background: #fffdf8; border: 1px solid #e4dccb; border-radius: 12px; padding: 1rem; margin: 0 0 1rem; }
    label { display: block; font-size: .85rem; margin: .6rem 0 .2rem; }
    input, button { font: inherit; min-height: 2.6rem; }
    input { width: 100%; box-sizing: border-box; padding: .4rem .6rem; border: 1px solid #d9d0c0; border-radius: 8px; }
    button { margin-top: .7rem; border: 0; border-radius: 8px; background: #1f6b4a; color: white; padding: 0 .9rem; cursor: pointer; }
    pre { white-space: pre-wrap; background: #17202a; color: #e7eef6; padding: .8rem; border-radius: 8px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
  </style>
</head>
<body>
  <header><h1>RelayMart</h1><p>Frontend talks only to the API gateway at <code id="gw"></code>.</p></header>
  <main>
    <section>
      <h2>Register</h2>
      <div class="row">
        <div><label>Name</label><input id="name" value="Asha Menon"></div>
        <div><label>Email</label><input id="email" value="asha@classroom.relaymart"></div>
        <div><label>Mobile</label><input id="mobile" value="9845012345"></div>
        <div><label>Password</label><input id="password" type="password" value="classroom123"></div>
      </div>
      <button id="register">Create account</button>
    </section>
    <section>
      <h2>Verify email and mobile</h2>
      <p>The code is not emailed. It is published to RabbitMQ and written to stdout, so it shows up in Kibana.</p>
      <label>Email code</label><input id="emailCode">
      <button id="sendEmail">Send email code</button>
      <button id="confirmEmail">Confirm email</button>
      <label>Mobile code</label><input id="mobileCode">
      <button id="sendMobile">Send mobile code</button>
      <button id="confirmMobile">Confirm mobile</button>
    </section>
    <section>
      <h2>Login and track</h2>
      <button id="login">Login</button>
      <label>Order id</label><input id="orderId" value="ord_demo">
      <label>Pincode</label><input id="pincode" value="560001">
      <button id="ship">Create shipment</button>
      <button id="scan">Scan: picked up</button>
      <pre id="out">Ready.</pre>
    </section>
  </main>
  <script>
    const gateway = ${JSON.stringify(gateway)};
    document.getElementById("gw").textContent = gateway;
    const out = document.getElementById("out");
    const val = (id) => document.getElementById(id).value.trim();
    let shipmentId = "";
    function show(data) { out.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2); }
    async function api(path, body) {
      const res = await fetch(gateway + path, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({}));
      show(json);
      if (!res.ok) throw new Error(json.error || String(res.status));
      return json;
    }
    document.getElementById("register").onclick = () => api("/api/register", {
      name: val("name"), email: val("email"), mobile: val("mobile"), password: val("password")
    }).catch(show);
    document.getElementById("sendEmail").onclick = () => api("/api/verify/email/send", { email: val("email") }).catch(show);
    document.getElementById("confirmEmail").onclick = () => api("/api/verify/email/confirm", { email: val("email"), code: val("emailCode") }).catch(show);
    document.getElementById("sendMobile").onclick = () => api("/api/verify/mobile/send", { mobile: val("mobile") }).catch(show);
    document.getElementById("confirmMobile").onclick = () => api("/api/verify/mobile/confirm", { mobile: val("mobile"), code: val("mobileCode") }).catch(show);
    document.getElementById("login").onclick = () => api("/api/login", { email: val("email"), password: val("password") }).catch(show);
    document.getElementById("ship").onclick = () => api("/api/tracking/shipments", { orderId: val("orderId"), pincode: val("pincode") })
      .then((json) => { shipmentId = json.id; }).catch(show);
    document.getElementById("scan").onclick = () => {
      if (!shipmentId) return show("Create a shipment first");
      api("/api/tracking/shipments/" + shipmentId + "/scan", { status: "picked_up", note: "hub scan" }).catch(show);
    };
  </script>
</body>
</html>`;

start({
  name: process.env.SERVICE_NAME || "frontend",
  routes: [
    {
      method: "GET",
      path: "/",
      handler: () => ({ contentType: "text/html; charset=utf-8", body: page }),
    },
  ],
});
