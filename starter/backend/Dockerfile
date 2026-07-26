# Stage 1: Build the Go binary
FROM golang:alpine AS builder

RUN apk add --no-cache git ca-certificates
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=0
RUN go build -o /bin/aurora-backend ./cmd/server

# Stage 2: Minimal runtime image
FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=builder /bin/aurora-backend /bin/aurora-backend

EXPOSE 8080
ENV PORT=8080
CMD ["/bin/aurora-backend"]
