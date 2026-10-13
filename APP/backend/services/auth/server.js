import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { logEvent, pgPool, publish, rabbitChannel, redisClient } from "../../lib/data.js";
import { start } from "../../lib/http.js";

const scrypt = promisify(scryptCb);
const pool = await pgPool();
const redis = await redisClient();
const channel = await rabbitChannel();
const sessions = new Map();

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanMobile(value) {
  let digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 32);
  return `${salt}:${buf.toString("hex")}`;
}

async function checkPassword(password, stored) {
  const [salt, hex] = String(stored).split(":");
  if (!salt || !hex) return false;
  const buf = await scrypt(password, salt, 32);
  const got = Buffer.from(hex, "hex");
  if (buf.length !== got.length) return false;
  return timingSafeEqual(buf, got);
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    emailVerified: row.email_verified,
    mobileVerified: row.mobile_verified,
  };
}

async function saveSession(userId) {
  const token = randomBytes(24).toString("hex");
  if (redis) await redis.set(`session:${token}`, userId, { EX: 60 * 60 * 12 });
  else sessions.set(token, userId);
  return token;
}

async function userIdFor(token) {
  if (!token) return null;
  if (redis) return redis.get(`session:${token}`);
  return sessions.get(token) || null;
}

start({
  name: process.env.SERVICE_NAME || "auth",
  routes: [
    {
      method: "POST",
      path: "/register",
      async handler({ body }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const name = String(body.name || "").trim();
        const email = cleanEmail(body.email);
        const mobile = cleanMobile(body.mobile);
        const password = String(body.password || "");
        if (name.length < 2 || !email.includes("@") || !mobile || password.length < 8) {
          return { status: 400, body: { error: "name, email, Indian mobile (10 digits starting 6-9), and 8+ character password required" } };
        }
        const id = `usr_${randomUUID().slice(0, 8)}`;
        const passwordHash = await hashPassword(password);
        try {
          await pool.query(
            `INSERT INTO users (id, name, email, mobile, password_hash) VALUES ($1, $2, $3, $4, $5)`,
            [id, name, email, mobile, passwordHash],
          );
        } catch (error) {
          if (error && error.code === "23505") return { status: 409, body: { error: "email_or_mobile_taken" } };
          throw error;
        }
        const user = { id, name, email, mobile, emailVerified: false, mobileVerified: false };
        await publish(channel, "user.registered", { id, email, mobile });
        logEvent("auth", "registered", { userId: id, email });
        return { status: 201, body: { user } };
      },
    },
    {
      method: "POST",
      path: "/login",
      async handler({ body }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const email = cleanEmail(body.email);
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const row = result.rows[0];
        if (!row || !(await checkPassword(String(body.password || ""), row.password_hash))) {
          logEvent("auth", "login_failed", { email }, "warn");
          return { status: 401, body: { error: "invalid_login" } };
        }
        if (!row.email_verified || !row.mobile_verified) {
          return { status: 403, body: { error: "verification_required", user: publicUser(row) } };
        }
        const token = await saveSession(row.id);
        logEvent("auth", "login", { userId: row.id });
        return { body: { token, user: publicUser(row) } };
      },
    },
    {
      method: "GET",
      path: "/me",
      async handler({ query }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const userId = await userIdFor(query.get("token"));
        if (!userId) return { status: 401, body: { error: "invalid_token" } };
        const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        if (!result.rows[0]) return { status: 401, body: { error: "invalid_token" } };
        return { body: { user: publicUser(result.rows[0]) } };
      },
    },
    {
      method: "POST",
      path: "/mark-verified",
      async handler({ body }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const channelName = body.channel === "mobile" ? "mobile_verified" : "email_verified";
        const column = body.channel === "mobile" ? "mobile" : "email";
        const value = body.channel === "mobile" ? cleanMobile(body.value) : cleanEmail(body.value);
        const result = await pool.query(
          `UPDATE users SET ${channelName} = TRUE WHERE ${column} = $1 RETURNING id, email, mobile`,
          [value],
        );
        if (!result.rows[0]) return { status: 404, body: { error: "user_not_found" } };
        logEvent("auth", "verified", { channel: body.channel, userId: result.rows[0].id });
        return { body: { ok: true, userId: result.rows[0].id } };
      },
    },
  ],
});
