import { randomInt } from "node:crypto";
import { logEvent, publish, rabbitChannel, redisClient } from "../../lib/data.js";
import { start } from "../../lib/http.js";

const redis = await redisClient();
const channel = await rabbitChannel();
const memory = new Map();

function code() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function putOtp(key, value) {
  if (redis) await redis.set(key, value, { EX: 300 });
  else memory.set(key, { value, exp: Date.now() + 300_000 });
}

async function takeOtp(key, given) {
  let value = null;
  if (redis) value = await redis.get(key);
  else {
    const row = memory.get(key);
    if (row && row.exp > Date.now()) value = row.value;
  }
  if (!value || value !== given) return false;
  if (redis) await redis.del(key);
  else memory.delete(key);
  return true;
}

function routePair(kind) {
  const noun = kind === "email" ? "email" : "mobile";
  return [
    {
      method: "POST",
      path: `/${noun}/send`,
      async handler({ body }) {
        const raw = String(body[noun] || "");
        const value = noun === "email" ? raw.trim().toLowerCase() : raw.replace(/[^\d]/g, "");
        if (!value) return { status: 400, body: { error: `${noun}_required` } };
        const otp = code();
        await putOtp(`otp:${noun}:${value}`, otp);
        const event = { channel: noun, to: value, code: otp, expSeconds: 300 };
        await publish(channel, `otp.${noun}`, event);
        logEvent("verification", "otp_issued", event);
        return { status: 202, body: { sent: true, channel: noun, to: value, expSeconds: 300 } };
      },
    },
    {
      method: "POST",
      path: `/${noun}/confirm`,
      async handler({ body }) {
        const raw = String(body[noun] || "");
        const value = noun === "email" ? raw.trim().toLowerCase() : raw.replace(/[^\d]/g, "");
        const given = String(body.code || "").trim();
        const ok = await takeOtp(`otp:${noun}:${value}`, given);
        if (!ok) {
          logEvent("verification", "otp_rejected", { channel: noun, to: value }, "warn");
          return { status: 400, body: { error: "invalid_code" } };
        }
        logEvent("verification", "otp_confirmed", { channel: noun, to: value });
        return { body: { verified: true, channel: noun, to: value } };
      },
    },
  ];
}

start({
  name: process.env.SERVICE_NAME || "verification",
  routes: [...routePair("email"), ...routePair("mobile")],
});
