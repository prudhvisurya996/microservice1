#!/usr/bin/env python3
"""Stage 1 log monitor for RelayMart.

Pandas summarizes the logs. The small neural net from anomaly.py flags odd lines.
A prompt picks which incidents to explain. No Bedrock, SageMaker, or Streamlit.

  python3 stage1.py
  python3 stage1.py --logs logs.jsonl --prompt "why did login fail"
"""

import argparse
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from anomaly import Autoencoder, features, is_normal, label, load_logs, sample_logs

HERE = Path(__file__).resolve().parent
OUT = HERE / "reports"


def frame(rows):
    records = []
    for row in rows:
        event = row.get("event") or {}
        user = row.get("user") or {}
        order = row.get("order") or {}
        records.append({
            "ts": row.get("ts", ""),
            "level": row.get("level", "info"),
            "service": row.get("service", ""),
            "category": event.get("category", ""),
            "action": event.get("action") or row.get("msg") or "",
            "email": user.get("email", "") if isinstance(user, dict) else "",
            "amount": float((order or {}).get("amount") or (row.get("payment") or {}).get("amount") or 0),
            "status": int(row.get("status") or 0),
            "path": row.get("path") or "",
        })
    return pd.DataFrame.from_records(records)


def explain(row, score):
    action = row["action"]
    if action in ("login_failed", "login_blocked", "code_rejected"):
        return f"{row['email'] or 'a user'} failed {action}. Check the password or the verification code."
    if int(row.get("status") or 0) >= 500:
        return f"{row['service']} returned {row['status']} on {row.get('path', row['action'])}."
    if int(row.get("status") or 0) >= 400:
        return f"{row['service']} returned {row['status']} on {row.get('path', row['action'])}."
    if row["level"] in ("warn", "error"):
        return f"{row['service']} logged {row['level']} on {action}."
    if row["amount"] >= 100000:
        return f"Amount {int(row['amount'])} is far above normal orders."
    return f"Reconstruction error {score:.4f} is above the trained normal pattern."


def matches(row, prompt):
    if not prompt:
        return True
    text = f"{row['category']} {row['action']} {row['email']} {row['level']} {row['service']}".lower()
    words = [word for word in prompt.lower().split() if len(word) > 2]
    return any(word in text or word.rstrip("s") in text for word in words)


def write_dashboard(df, scores, threshold):
    counts = df.groupby(["level", "category", "action"], dropna=False).size().reset_index(name="count")
    rows_html = []
    for record, score in zip(df.to_dict("records"), scores):
        flag = score > threshold
        if not flag:
            continue
        rows_html.append(
            f"<tr><td>{record['ts']}</td><td>{record['action']}</td><td>{record['email']}</td>"
            f"<td>{score:.4f}</td><td>{explain(record, score)}</td></tr>"
        )
    count_html = "".join(
        f"<tr><td>{r.level}</td><td>{r.category}</td><td>{r.action}</td><td>{int(r.count)}</td></tr>"
        for r in counts.itertuples(index=False)
    )
    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>RelayMart log monitor</title>
<style>
body {{ font-family: sans-serif; margin: 24px; color: #1c2430; }}
table {{ border-collapse: collapse; width: 100%; margin: 12px 0 28px; }}
th, td {{ border-bottom: 1px solid #ddd; text-align: left; padding: 8px; }}
th {{ background: #1f6b4a; color: white; }}
</style></head><body>
<h1>RelayMart log monitor</h1>
<p>{len(df)} lines. Anomaly threshold {threshold:.4f}. Errors: {int((df.level == "error").sum())}. Warnings: {int((df.level == "warn").sum())}.</p>
<h2>Counts</h2>
<table><tr><th>Level</th><th>Category</th><th>Action</th><th>Count</th></tr>{count_html}</table>
<h2>Anomalies</h2>
<table><tr><th>Time</th><th>Action</th><th>User</th><th>Score</th><th>Why</th></tr>{''.join(rows_html) or '<tr><td colspan="5">None</td></tr>'}</table>
</body></html>"""
    path = OUT / "dashboard.html"
    path.write_text(html)
    return path


def write_incident(df, scores, threshold, prompt):
    hits = []
    for record, score in zip(df.to_dict("records"), scores):
        if score > threshold and matches(record, prompt):
            hits.append((record, score))
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# Incident report",
        f"",
        f"Opened: {stamp}",
        f"Prompt: {prompt or 'all anomalies'}",
        f"Model: local autoencoder. Bedrock is not called.",
        f"",
    ]
    if not hits:
        lines.append("No matching anomaly.")
    for record, score in hits:
        lines += [
            f"## {record['category']} / {record['action']}",
            f"- User: {record['email'] or 'unknown'}",
            f"- Service: {record['service']}",
            f"- Level: {record['level']}",
            f"- Score: {score:.4f} (threshold {threshold:.4f})",
            f"- Evidence: {explain(record, score)}",
            "",
        ]
    path = OUT / "incident.md"
    path.write_text("\n".join(lines))
    return path, len(hits)


def analyze(rows, prompt=""):
    df = frame(rows)
    import numpy as np

    vectors = np.vstack([features(row) for row in rows])
    normal = [i for i, row in enumerate(rows) if is_normal(row)]
    if len(normal) < 4:
        return None
    model = Autoencoder(vectors.shape[1])
    model.fit(vectors[normal])
    train_error = model.score(vectors[normal])
    threshold = float(train_error.mean() + 3 * max(train_error.std(), 1e-6))
    scores = model.score(vectors)
    OUT.mkdir(exist_ok=True)
    dash = write_dashboard(df, scores, threshold)
    report, n = write_incident(df, scores, threshold, prompt.strip())
    return {
        "lines": len(df),
        "anomalies": int((scores > threshold).sum()),
        "matches": n,
        "dashboard": dash,
        "report": report,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--logs", help="JSON lines exported from the app or Elasticsearch")
    parser.add_argument("--prompt", default="", help="Plain question, for example: why did login fail")
    args = parser.parse_args()

    if args.logs:
        rows = load_logs(args.logs)
    else:
        import json
        rows = sample_logs()
        (HERE / "sample-logs.jsonl").write_text("".join(json.dumps(row) + "\n" for row in rows))

    result = analyze(rows, args.prompt)
    if not result:
        raise SystemExit("Need at least 4 normal log lines.")
    print(f"lines {result['lines']}  anomalies {result['anomalies']}  report matches {result['matches']}")
    print(result["dashboard"])
    print(result["report"])


if __name__ == "__main__":
    main()
