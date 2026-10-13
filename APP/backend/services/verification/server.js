import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { audit, logEvent, publish, rabbitChannel, redisClient } from "../../lib/data.js";
import { start } from "../../lib/http.js";

const redis = await redisClient();
const channel = await rabbitChannel();
const memory = new Map();

function code() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function indianMobile(value) {
  let digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
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

async function sendGmail(to, otp) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { delivered: false, reason: "gmail_not_configured" };
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: `RelayMart <${user}>`,
    to,
    subject: "Your RelayMart code",
    text: `Your RelayMart verification code is ${otp}. It expires in 5 minutes.`,
  });
  return { delivered: true, reason: "gmail" };
}

async function sendIndiaSms(mobile, otp) {
  const key = process.env.SMS_API_KEY;
  if (!key) return { delivered: false, reason: "sms_not_configured" };
  const provider = String(process.env.SMS_PROVIDER || "fast2sms").toLowerCase();
  if (provider === "msg91") {
    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { authkey: key, "content-type": "application/json" },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: `91${mobile}`,
        otp,
      }),
    });
    return { delivered: response.ok, reason: response.ok ? "msg91" : "msg91_failed" };
  }
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    body: JSON.stringify({ route: "otp", variables_values: otp, numbers: mobile }),
  });
  const json = await response.json().catch(() => ({}));
  const ok = response.ok && json.return !== false;
  return { delivered: ok, reason: ok ? "fast2sms" : "sms_failed" };
}

function routePair(kind) {
  const noun = kind === "email" ? "email" : "mobile";
  return [
    {
      method: "POST",
      path: `/${noun}/send`,
      async handler({ body }) {
        const raw = String(body[noun] || "");
        const value = noun === "email" ? raw.trim().toLowerCase() : indianMobile(raw);
        if (!value) {
          return {
            status: 400,
            body: { error: noun === "email" ? "email_required" : "indian_mobile_required" },
          };
        }
        const otp = code();
        await putOtp(`otp:${noun}:${value}`, otp);
        let delivery = { delivered: false, reason: "not_sent" };
        try {
          delivery = noun === "email" ? await sendGmail(value, otp) : await sendIndiaSms(value, otp);
        } catch (error) {
          delivery = { delivered: false, reason: "provider_error" };
          logEvent("verification", "otp_delivery_failed", { event: { category: "verification", action: "delivery_failed" }, user: { email: noun === "email" ? value : "", mobile: noun === "mobile" ? value : "" }, detail: String(error.message || error) }, "error");
        }
        await publish(channel, `otp.${noun}`, { channel: noun, to: value, expSeconds: 300, delivered: delivery.delivered });
        const logged = {
          event: { dataset: "relaymart.verification", category: "verification", action: "code_issued" },
          user: noun === "email" ? { email: value } : { mobile: value },
          channel: noun,
          expSeconds: 300,
          delivered: delivery.delivered,
          via: delivery.reason,
        };
        logEvent("verification", "code_issued", logged);
        const responseBody = {
          sent: true,
          delivered: delivery.delivered,
          via: delivery.reason,
          channel: noun,
          to: value,
          expSeconds: 300,
        };
        if (!delivery.delivered) responseBody.code = otp;
        return { status: 202, body: responseBody };
      },
    },
    {
      method: "POST",
      path: `/${noun}/confirm`,
      async handler({ body }) {
        const raw = String(body[noun] || "");
        const value = noun === "email" ? raw.trim().toLowerCase() : indianMobile(raw);
        const given = String(body.code || "").trim();
        if (!value) return { status: 400, body: { error: noun === "email" ? "email_required" : "indian_mobile_required" } };
        const ok = await takeOtp(`otp:${noun}:${value}`, given);
        if (!ok) {
          audit("verification", "verification", "code_rejected", { user: noun === "email" ? { email: value } : { mobile: value }, channel: noun }, "warn");
          return { status: 400, body: { error: "invalid_code" } };
        }
        audit("verification", "verification", "code_confirmed", { user: noun === "email" ? { email: value } : { mobile: value }, channel: noun });
        return { body: { verified: true, channel: noun, to: value } };
      },
    },
  ];
}

start({
  name: process.env.SERVICE_NAME || "verification",
  routes: [...routePair("email"), ...routePair("mobile")],
});
