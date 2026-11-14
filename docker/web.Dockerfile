# Production web server: the built React app, served by Caddy, which also proxies /api to the
# API and gets HTTPS certificates automatically. Builds for amd64 and arm64.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /web/dist /srv
