#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing $ROOT/.env — create it before deploying."
  exit 1
fi

DEPLOY_BRANCH="${DEPLOY_BRANCH:-votelytics}"

echo "==> Fetching origin/$DEPLOY_BRANCH"
git config --global --add safe.directory "$ROOT" >/dev/null 2>&1 || true
if git remote get-url origin >/dev/null 2>&1; then
  git fetch origin "$DEPLOY_BRANCH"
  git checkout "$DEPLOY_BRANCH"
  git reset --hard "origin/$DEPLOY_BRANCH"
else
  echo "No git remote — deploying current working tree"
fi

export GIT_SHA
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
export BUILD_TIME
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Building & starting (sha=$GIT_SHA built=$BUILD_TIME)"
docker compose build --build-arg GIT_SHA="$GIT_SHA" --build-arg BUILD_TIME="$BUILD_TIME"
docker compose up -d

echo "==> Waiting for API"
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:13011/health" >/dev/null; then
    break
  fi
  sleep 2
done

if [[ "${SEED_ON_DEPLOY:-false}" == "true" ]]; then
  echo "==> Seeding admin user"
  docker compose run --rm --entrypoint sh api -c 'cd /app/apps/api && npx tsx prisma/seed.ts'
fi

echo "==> Deployed"
echo "    gitSha=$GIT_SHA"
curl -sf "http://127.0.0.1:13011/health" || true
echo
docker compose ps
