#!/bin/sh
set -eu
cd /app/apps/api
echo "Applying Prisma schema…"
npx prisma db push
exec node dist/index.js
