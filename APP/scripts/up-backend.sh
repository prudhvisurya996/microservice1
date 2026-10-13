#!/bin/sh
# Backend server. Run from any directory.
set -eu
cd "$(dirname "$0")/../backend"
docker compose up --build -d
echo "Backend is starting. Check: curl -s http://127.0.0.1:4000/health"
