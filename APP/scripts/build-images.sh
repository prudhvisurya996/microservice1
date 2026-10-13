#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
tag="${1:-local}"
services="frontend gateway catalog search pricing inventory cart order payment shipping review user notification recommendation auth verification tracking"
for name in $services; do
  file="services/$name/Dockerfile"
  if [ "$name" = "frontend" ]; then file="frontend/Dockerfile"; fi
  if [ "$name" = "gateway" ]; then file="gateway/Dockerfile"; fi
  echo "build relaymart/$name:$tag"
  docker build -f "$file" -t "relaymart/$name:$tag" .
done
