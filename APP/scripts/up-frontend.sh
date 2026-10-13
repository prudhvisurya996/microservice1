#!/bin/sh
# Frontend server. The browser calls the backend gateway directly.
set -eu
cd "$(dirname "$0")/../frontend"
: "${GATEWAY_PUBLIC_URL:?Set GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000}"
docker compose up --build -d
echo "Shop is on port 4173. API is $GATEWAY_PUBLIC_URL"
