# syntax=docker/dockerfile:1

# ---- Build ----
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git tzdata

WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -trimpath -ldflags="-s -w" -o /out/aurora-backend ./cmd/server

# ---- Runtime ----
FROM debian:bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    tzdata \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 10001 appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /out/aurora-backend /app/aurora-backend

USER appuser

EXPOSE 8080

ENV PORT=8080
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROME_CRASHPAD_DISABLE=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/v1/catalog/sectors >/dev/null 2>&1 || exit 0

CMD ["/app/aurora-backend"]
