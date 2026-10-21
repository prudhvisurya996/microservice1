#!/usr/bin/env python3
"""Small log anomaly detector.

Train a tiny autoencoder on normal RelayMart JSON logs, then flag odd lines.
Optional: upload the same file to S3 when S3_BUCKET is set.

  python3 anomaly.py
  python3 anomaly.py --logs my-logs.jsonl
  S3_BUCKET=my-bucket python3 anomaly.py --logs my-logs.jsonl
"""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

CATEGORIES = ["authentication", "order", "payment", "tracking", "verification"]
ACTIONS = [
    "registered", "login", "logout", "login_failed", "login_blocked",
    "placed", "cancelled", "authorized", "created", "scan",
    "code_issued", "code_confirmed", "code_rejected",
]
NORMAL_ACTIONS = {"registered", "login", "logout", "placed", "authorized", "created", "scan", "code_issued", "code_confirmed"}


def sample_logs():
    """A few normal lines plus three anomalies, in the same JSON shape as the app."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = []

    def add(category, action, email, amount=0, level="info"):
        rows.append({
            "ts": now,
            "level": level,
            "service": "gateway" if category == "order" else category,
            "msg": action,
            "event": {"dataset": f"relaymart.{category}", "category": category, "action": action},
            "user": {"email": email},
            "order": {"amount": amount} if amount else {},
        })

    for email in ("meera@gmail.com", "rohan@gmail.com", "asha@gmail.com"):
        add("authentication", "registered", email)
        add("authentication", "login", email)
        add("order", "placed", email, 4290)
        add("payment", "authorized", email, 4290)
        add("tracking", "created", email)
        add("authentication", "logout", email)
    add("authentication", "login_failed", "asha@gmail.com", level="warn")
    add("order", "placed", "meera@gmail.com", 900000)
    add("payment", "authorized", "unknown@gmail.com", 900000, level="error")
    return rows


def load_logs(path):
    rows = []
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def upload_s3(path, bucket, key):
    import boto3

    boto3.client("s3").upload_file(str(path), bucket, key)
    print(f"uploaded s3://{bucket}/{key}")


def features(row):
    event = row.get("event") or {}
    category = event.get("category") or ""
    action = event.get("action") or row.get("msg") or ""
    amount = 0
    order = row.get("order") or {}
    payment = row.get("payment") or {}
    if isinstance(order, dict):
        amount = float(order.get("amount") or 0)
    if not amount and isinstance(payment, dict):
        amount = float(payment.get("amount") or 0)
    user = row.get("user") or {}
    email = user.get("email") if isinstance(user, dict) else ""
    status = float(row.get("status") or 0)
    ms = float(row.get("ms") or 0)
    return np.array([
        (CATEGORIES.index(category) + 1) / len(CATEGORIES) if category in CATEGORIES else 0,
        (ACTIONS.index(action) + 1) / len(ACTIONS) if action in ACTIONS else 0,
        min(amount, 200000) / 200000,
        1.0 if row.get("level") in ("warn", "error") else 0.0,
        1.0 if email else 0.0,
        min(status, 599) / 599,
        min(ms, 5000) / 5000,
    ], dtype=np.float64)


def is_normal(row):
    status = row.get("status")
    if status is not None:
        return int(status) < 400 and row.get("level", "info") == "info"
    event = row.get("event") or {}
    action = event.get("action") or row.get("msg") or ""
    amount = float((row.get("order") or {}).get("amount") or (row.get("payment") or {}).get("amount") or 0)
    return row.get("level", "info") == "info" and action in NORMAL_ACTIONS and amount < 100000


class Autoencoder:
    """One hidden layer. Input is reconstructed; a high error means the line is odd."""

    def __init__(self, size, hidden=3, seed=1):
        rng = np.random.default_rng(seed)
        self.w1 = rng.normal(0, 0.3, (size, hidden))
        self.b1 = np.zeros(hidden)
        self.w2 = rng.normal(0, 0.3, (hidden, size))
        self.b2 = np.zeros(size)

    def forward(self, x):
        hidden = np.tanh(x @ self.w1 + self.b1)
        out = hidden @ self.w2 + self.b2
        return hidden, out

    def fit(self, x, epochs=60, lr=0.08):
        n = len(x)
        for _ in range(epochs):
            hidden, out = self.forward(x)
            error = out - x
            grad_hidden = (error @ self.w2.T) * (1 - hidden * hidden)
            self.w2 -= lr * (hidden.T @ error) / n
            self.b2 -= lr * error.mean(axis=0)
            self.w1 -= lr * (x.T @ grad_hidden) / n
            self.b1 -= lr * grad_hidden.mean(axis=0)

    def score(self, x):
        _, out = self.forward(x)
        return np.mean((out - x) ** 2, axis=1)


def label(row):
    event = row.get("event") or {}
    email = (row.get("user") or {}).get("email", "")
    return f"{event.get('category', '?')}/{event.get('action', row.get('msg', '?'))} {email}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--logs", help="JSON lines file. If omitted, a small sample is written.")
    args = parser.parse_args()

    here = Path(__file__).resolve().parent
    log_path = Path(args.logs) if args.logs else here / "sample-logs.jsonl"
    if not args.logs:
        rows = sample_logs()
        log_path.write_text("".join(json.dumps(row) + "\n" for row in rows))
        print(f"wrote {log_path}")
    else:
        rows = load_logs(log_path)

    bucket = os.environ.get("S3_BUCKET", "").strip()
    if bucket:
        key = os.environ.get("S3_KEY", f"relaymart/logs/{log_path.name}")
        upload_s3(log_path, bucket, key)
    else:
        print("S3 skipped. Set S3_BUCKET=your-bucket to upload this file.")

    vectors = np.vstack([features(row) for row in rows])
    normal_idx = [i for i, row in enumerate(rows) if is_normal(row)]
    if len(normal_idx) < 4:
        raise SystemExit("Need at least 4 normal log lines to train.")

    model = Autoencoder(vectors.shape[1])
    model.fit(vectors[normal_idx])
    train_error = model.score(vectors[normal_idx])
    threshold = float(train_error.mean() + 3 * train_error.std())
    np.savez(here / "model.npz", w1=model.w1, b1=model.b1, w2=model.w2, b2=model.b2, threshold=threshold)

    print(f"trained on {len(normal_idx)} normal lines  threshold={threshold:.5f}")
    print(f"{'score':>10}  result")
    for row, score in zip(rows, model.score(vectors)):
        flag = "ANOMALY" if score > threshold else "ok"
        print(f"{score:10.5f}  {flag:7}  {label(row)}")


if __name__ == "__main__":
    main()
