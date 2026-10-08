# Stage 1: Build the Go binary
FROM golang:alpine AS builder

RUN apk add --no-cache git ca-certificates
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=0
RUN go build -o /bin/aurora-backend ./cmd/server

# Stage 2: Runtime image (Debian slim: glibc + Chromium for PDF rendering)
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
COPY --from=builder --chown=appuser:appuser /bin/aurora-backend /app/aurora-backend

USER appuser

EXPOSE 8080
ENV PORT=8080
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROME_CRASHPAD_DISABLE=1
CMD ["/app/aurora-backend"]
