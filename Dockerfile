# syntax=docker/dockerfile:1

# ---- frontend ----
FROM node:26-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- backend ----
FROM golang:1.26-alpine AS api
# Override where proxy.golang.org is unreachable (e.g. GOPROXY=https://goproxy.cn,direct).
# Modules are still verified against go.sum, so a mirror cannot alter them.
ARG GOPROXY=https://proxy.golang.org,direct
ENV GOPROXY=${GOPROXY} GOTOOLCHAIN=local
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/shiftyar ./cmd/server

# ---- runtime ----
FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget \
 && adduser -D -H -u 10001 shiftyar \
 && mkdir -p /data && chown shiftyar /data
WORKDIR /app
COPY --from=api /out/shiftyar /app/shiftyar
COPY --from=web /web/dist /app/web
ENV PORT=8080 \
    STATIC_DIR=/app/web \
    DB_DRIVER=sqlite \
    DB_DSN=/data/shiftyar.db
VOLUME /data
USER shiftyar
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
ENTRYPOINT ["/app/shiftyar"]
