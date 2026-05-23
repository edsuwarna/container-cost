# ─── Builder ───────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build
COPY . .
RUN CGO_ENABLED=1 go build -ldflags="-s -w" -o /app/docker-cost ./cmd/server

# ─── Runner ────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates sqlite-libs tzdata

# Timezone support
ENV TZ=Asia/Jakarta

WORKDIR /app

# Copy binary
COPY --from=builder /app/docker-cost .

# Copy frontend
COPY --from=builder /app/web/dist ./web/dist

# Volume for config & database
VOLUME ["/data"]

# Expose API port
EXPOSE 8080

# Default env
ENV PORT=8080
ENV DOCKER_COST_CONFIG_DIR=/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/app/docker-cost"]
