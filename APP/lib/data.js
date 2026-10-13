import amqp from "amqplib";
import pg from "pg";
import { createClient } from "redis";

export function logEvent(service, msg, extra = {}, level = "info") {
  process.stdout.write(
    `${JSON.stringify({ ts: new Date().toISOString(), level, service, msg, ...extra })}\n`,
  );
}

async function waitFor(label, fn, tries = 30) {
  let last = new Error(label);
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      logEvent(process.env.SERVICE_NAME || "data", "waiting", { label, attempt }, "warn");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw last;
}

export async function pgPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const pool = new pg.Pool({ connectionString });
  await waitFor("postgres", () => pool.query("select 1"));
  return pool;
}

export async function redisClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = createClient({ url });
  client.on("error", (error) => {
    logEvent(process.env.SERVICE_NAME || "data", "redis_error", { error: error.message }, "warn");
  });
  await waitFor("redis", async () => {
    if (!client.isOpen) await client.connect();
    return client.ping();
  });
  return client;
}

export async function rabbitChannel() {
  const url = process.env.RABBIT_URL;
  if (!url) return null;
  const conn = await waitFor("rabbitmq", () => amqp.connect(url));
  const channel = await conn.createChannel();
  await channel.assertExchange("relaymart", "topic", { durable: true });
  return channel;
}

export async function publish(channel, key, payload) {
  if (!channel) return;
  channel.publish("relaymart", key, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
}
