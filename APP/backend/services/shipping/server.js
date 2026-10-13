import { start } from "../../lib/http.js";

start({
  name: process.env.SERVICE_NAME || "shipping",
  routes: [
    {
      method: "POST",
      path: "/eta",
      handler({ body }) {
        const pincode = String(body.pincode || "");
        if (!/^\d{6}$/.test(pincode)) return { status: 400, body: { error: "pincode must be 6 digits" } };
        let hub = "National";
        let days = 4;
        if (pincode.startsWith("56")) {
          hub = "Bengaluru";
          days = 1;
        } else if (pincode.startsWith("40")) {
          hub = "Mumbai";
          days = 2;
        } else if (pincode.startsWith("11")) {
          hub = "Delhi";
          days = 2;
        }
        return { body: { pincode, hub, days } };
      },
    },
  ],
});
