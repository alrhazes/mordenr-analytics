# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM deps AS build
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV GIT_SHA=$GIT_SHA BUILD_TIME=$BUILD_TIME
COPY apps/api apps/api
COPY apps/web apps/web
COPY assets assets
RUN npm run db:generate -w @sentra/api \
  && npm run build -w @sentra/api \
  && npm run build -w @sentra/web

FROM nginx:1.27-alpine AS web
COPY deploy/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

FROM base AS api
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV GIT_SHA=$GIT_SHA BUILD_TIME=$BUILD_TIME NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/package.json /app/package-lock.json /app/
COPY --from=deps /app/apps/api/package.json /app/apps/api/
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build /app/apps/api/src /app/apps/api/src
COPY --from=build /app/assets /app/assets
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build /app/node_modules/@prisma /app/node_modules/@prisma
COPY deploy/api-entrypoint.sh /app/deploy/api-entrypoint.sh
RUN chmod +x /app/deploy/api-entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["/app/deploy/api-entrypoint.sh"]
