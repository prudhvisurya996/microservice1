import { randomUUID } from "node:crypto";
import { logEvent, pgPool, publish, rabbitChannel } from "../../lib/data.js";
import { start } from "../../lib/http.js";

const STATUSES = ["created", "picked_up", "in_transit", "out_for_delivery", "delivered"];
const pool = await pgPool();
const channel = await rabbitChannel();

async function shipment(id) {
  const row = await pool.query(`SELECT * FROM shipments WHERE id = $1`, [id]);
  if (!row.rows[0]) return null;
  const events = await pool.query(
    `SELECT id, status, note, at FROM tracking_events WHERE shipment_id = $1 ORDER BY at`,
    [id],
  );
  return {
    id: row.rows[0].id,
    orderId: row.rows[0].order_id,
    pincode: row.rows[0].pincode,
    status: row.rows[0].status,
    updatedAt: row.rows[0].updated_at,
    events: events.rows,
  };
}

start({
  name: process.env.SERVICE_NAME || "tracking",
  routes: [
    {
      method: "POST",
      path: "/shipments",
      async handler({ body }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const orderId = String(body.orderId || "").trim();
        const pincode = String(body.pincode || "").trim();
        if (!orderId || pincode.length < 6) return { status: 400, body: { error: "orderId and pincode required" } };
        const id = `trk_${randomUUID().slice(0, 8)}`;
        await pool.query(
          `INSERT INTO shipments (id, order_id, pincode, status) VALUES ($1, $2, $3, 'created')`,
          [id, orderId, pincode],
        );
        await pool.query(
          `INSERT INTO tracking_events (id, shipment_id, status, note) VALUES ($1, $2, 'created', 'label created')`,
          [`evt_${randomUUID().slice(0, 8)}`, id],
        );
        const bodyOut = await shipment(id);
        await publish(channel, "tracking.updated", bodyOut);
        logEvent("tracking", "shipment_created", { shipmentId: id, orderId });
        return { status: 201, body: bodyOut };
      },
    },
    {
      method: "POST",
      path: "/shipments/:id/scan",
      async handler({ params, body }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const status = String(body.status || "");
        if (!STATUSES.includes(status)) return { status: 400, body: { error: "bad_status", allowed: STATUSES } };
        const updated = await pool.query(
          `UPDATE shipments SET status = $2, updated_at = now() WHERE id = $1 RETURNING id`,
          [params.id, status],
        );
        if (!updated.rows[0]) return { status: 404, body: { error: "not_found" } };
        await pool.query(
          `INSERT INTO tracking_events (id, shipment_id, status, note) VALUES ($1, $2, $3, $4)`,
          [`evt_${randomUUID().slice(0, 8)}`, params.id, status, String(body.note || "")],
        );
        const bodyOut = await shipment(params.id);
        await publish(channel, "tracking.updated", bodyOut);
        logEvent("tracking", "scan", { shipmentId: params.id, status });
        return { body: bodyOut };
      },
    },
    {
      method: "GET",
      path: "/shipments/:id",
      async handler({ params }) {
        if (!pool) return { status: 503, body: { error: "database_unconfigured" } };
        const bodyOut = await shipment(params.id);
        if (!bodyOut) return { status: 404, body: { error: "not_found" } };
        return { body: bodyOut };
      },
    },
  ],
});
