#!/usr/bin/env python3
"""Follow every application container and refresh the report as logs arrive.

  python3 watch.py
  python3 watch.py --prompt "why did login fail"

Leave it running. New requests and logins show up in reports/ without copying a file.
"""

import argparse
import json
import os
import subprocess
import threading
import time
from pathlib import Path

from stage1 import analyze

HERE = Path(__file__).resolve().parent
LIVE = HERE / "logs.jsonl"
SKIP = ("elasticsearch", "kibana", "grafana", "prometheus", "fluent", "postgres", "redis", "rabbit")
rows = []
lock = threading.Lock()
seen = set()


def containers():
    try:
        out = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}\t{{.Image}}"], text=True)
    except (OSError, subprocess.CalledProcessError):
        return []
    names = []
    for line in out.splitlines():
        name, _, image = line.partition("\t")
        blob = f"{name} {image}".lower()
        if name and not any(word in blob for word in SKIP):
            names.append(name)
    return names


def parse(line):
    line = line.strip()
    start = line.find("{")
    if start < 0:
        return None
    try:
        row = json.loads(line[start:])
    except json.JSONDecodeError:
        return None
    if not isinstance(row, dict):
        return None
    inner = row.get("log")
    if isinstance(inner, str) and inner.strip().startswith("{"):
        return parse(inner)
    if not row.get("service"):
        return None
    if any(word in str(row.get("service")).lower() for word in SKIP):
        return None
    return row


def remember(row):
    key = json.dumps(row, sort_keys=True)
    with lock:
        if key in seen:
            return
        seen.add(key)
        rows.append(row)
        if len(rows) > 2000:
            del rows[: len(rows) - 2000]
        with LIVE.open("a") as handle:
            handle.write(json.dumps(row) + "\n")


def follow(name):
    proc = subprocess.Popen(
        ["docker", "logs", "-f", "--tail", "300", name],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        row = parse(line)
        if row:
            remember(row)


def follow_file(path):
    with path.open(errors="replace") as handle:
        handle.seek(0, 2)
        handle.seek(max(0, handle.tell() - 200_000))
        handle.readline()
        while True:
            line = handle.readline()
            if not line:
                time.sleep(0.4)
                continue
            row = parse(line)
            if row:
                remember(row)


def elasticsearch_url():
    env = os.environ.get("ES_URL", "").strip()
    if env:
        return env.rstrip("/")
    path = HERE / "es.url"
    if not path.exists():
        return ""
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line.rstrip("/")
    return ""


def pull_elasticsearch(url):
    import urllib.request

    body = json.dumps({"size": 500, "sort": [{"@timestamp": "desc"}]}).encode()
    request = urllib.request.Request(
        f"{url}/relaymart-*/_search",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.load(response)
    found = []
    for hit in payload.get("hits", {}).get("hits", []):
        source = hit.get("_source") or {}
        if source.get("service"):
            found.append(source)
            continue
        raw = source.get("log")
        if isinstance(raw, str):
            row = parse(raw)
            if row:
                found.append(row)
    return found


def serve_reports():
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

    (HERE / "reports").mkdir(exist_ok=True)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(HERE / "reports"), **kwargs)

    ThreadingHTTPServer(("0.0.0.0", 8088), Handler).serve_forever()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", default=os.environ.get("PROMPT", ""), help="Optional. Empty means every anomaly.")
    args = parser.parse_args()
    LIVE.write_text("")
    threading.Thread(target=serve_reports, daemon=True).start()
    started = {}
    last = None
    es_url = elasticsearch_url()
    log_dir = Path(os.environ.get("LOG_DIR", ""))
    if es_url:
        print(f"reading logs from {es_url}")
    else:
        print("watching application logs. Stop with Ctrl+C.")
    while True:
        if es_url:
            try:
                for row in pull_elasticsearch(es_url):
                    remember(row)
            except Exception as error:
                print(f"elasticsearch not ready: {error}")
        elif log_dir.is_dir():
            for path in log_dir.glob("*/*-json.log"):
                key = str(path)
                if key not in started:
                    started[key] = threading.Thread(target=follow_file, args=(path,), daemon=True)
                    started[key].start()
                    print(f"following {path.name}")
        else:
            for name in containers():
                if name not in started:
                    started[name] = threading.Thread(target=follow, args=(name,), daemon=True)
                    started[name].start()
                    print(f"following {name}")
            if not started:
                print("no application logs yet")
        with lock:
            snapshot = list(rows)
        if len(snapshot) >= 4:
            result = analyze(snapshot, args.prompt)
            if result and (last is None or result["anomalies"] != last["anomalies"] or result["lines"] != last["lines"]):
                last = result
                print(
                    f"lines {result['lines']}  anomalies {result['anomalies']}  "
                    f"report matches {result['matches']}  {result['report']}"
                )
        time.sleep(5 if es_url else 2)


if __name__ == "__main__":
    main()

