import { randomUUID } from "node:crypto";
import { start } from "../../lib/http.js";

start({
  name: process.env.SERVICE_NAME || "payment",
  routes: [
    {
      method: "POST",
      path: "/authorize",
      handler({ body }) {
        const method = body.method || "upi";
        if (body.forceFail || method === "fail") {
          return { status: 402, body: { error: "declined", method } };
        }
        const payment = {
          paymentId: `pay_${randomUUID().slice(0, 8)}`,
          status: "authorized",
          method,
          amount: body.amount,
        };
        if (process.env.DATABASE_URL || process.env.RABBIT_URL) {
          import("../../lib/data.js")
            .then(async ({ pgPool, publish, rabbitChannel, audit }) => {
              const pool = process.env.DATABASE_URL ? await pgPool() : null;
              if (pool) {
                await pool.query(
                  `INSERT INTO payments (id, amount, method, status) VALUES ($1, $2, $3, 'authorized')`,
                  [payment.paymentId, Number(payment.amount) || 0, method],
                );
              }
              const channel = process.env.RABBIT_URL ? await rabbitChannel() : null;
              await publish(channel, "payment.authorized", payment);
              audit("payment", "payment", "authorized", {
                payment: { id: payment.paymentId, amount: payment.amount, method },
              });
            })
            .catch((error) => {
              process.stdout.write(
                `${JSON.stringify({ ts: new Date().toISOString(), level: "warn", service: "payment", msg: "record_failed", error: error.message })}\n`,
              );
            });
        }
        return { body: payment };
      },
    },
  ],
});
