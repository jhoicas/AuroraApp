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
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget \
  && adduser -D -H -u 10001 appuser

WORKDIR /app

COPY --from=builder /out/aurora-backend /app/aurora-backend

USER appuser

EXPOSE 8080

ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/v1/catalog/sectors >/dev/null 2>&1 || exit 0

CMD ["/app/aurora-backend"]
