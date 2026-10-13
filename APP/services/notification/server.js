import { randomUUID } from "node:crypto";
import { start } from "../../lib/http.js";

const events = [];

async function consume() {
  if (!process.env.RABBIT_URL) return;
  const { logEvent, rabbitChannel } = await import("../../lib/data.js");
  const keys = ["otp.email", "otp.mobile", "tracking.updated", "payment.authorized", "user.registered"];
  try {
    const channel = await rabbitChannel();
    for (const key of keys) {
      const queue = await channel.assertQueue(`notification.${key}`, { durable: true });
      await channel.bindQueue(queue.queue, "relaymart", key);
      channel.consume(queue.queue, (message) => {
        if (!message) return;
        const payload = JSON.parse(message.content.toString());
        const event = {
          id: randomUUID(),
          type: key,
          to: payload.to || payload.email || "",
          message: JSON.stringify(payload),
          at: new Date().toISOString(),
        };
        events.unshift(event);
        logEvent("notification", "delivered", { routingKey: key, to: event.to });
        channel.ack(message);
      });
    }
    logEvent("notification", "consuming", { keys });
  } catch (error) {
    logEvent("notification", "rabbit_unavailable", { error: error.message }, "warn");
  }
}

consume();

start({
  name: process.env.SERVICE_NAME || "notification",
  routes: [
    {
      method: "POST",
      path: "/notify",
      handler({ body }) {
        const event = {
          id: randomUUID(),
          type: body.type || "notice",
          to: body.to || "asha@classroom.relaymart",
          message: body.message || "",
          at: new Date().toISOString(),
        };
        events.unshift(event);
        return { status: 202, body: { event } };
      },
    },
    {
      method: "GET",
      path: "/notifications",
      handler() {
        return { body: { events: events.slice(0, 50) } };
      },
    },
  ],
});
