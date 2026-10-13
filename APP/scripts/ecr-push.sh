#!/bin/sh
# Build one image per service and push it to ECR.
#   AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-south-1 sh scripts/ecr-push.sh
set -eu
cd "$(dirname "$0")/.."
: "${AWS_ACCOUNT_ID:?set AWS_ACCOUNT_ID}"
: "${AWS_REGION:?set AWS_REGION}"
tag="${IMAGE_TAG:-latest}"
registry="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
services="frontend gateway catalog search pricing inventory cart order payment shipping review user notification recommendation auth verification tracking"
for name in $services; do
  repo="relaymart/$name"
  aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repo" >/dev/null 2>&1 \
    || aws ecr create-repository --region "$AWS_REGION" --repository-name "$repo" >/dev/null
  file="backend/services/$name/Dockerfile"
  context="backend"
  if [ "$name" = "frontend" ]; then file="frontend/Dockerfile"; context="frontend"; fi
  if [ "$name" = "gateway" ]; then file="backend/gateway/Dockerfile"; context="backend"; fi
  image="$registry/$repo:$tag"
  echo "push $image"
  docker build -f "$file" -t "$image" "$context"
  docker push "$image"
done
echo "ECR prefix: $registry/relaymart"
