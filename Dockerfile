# ─── Multi-stage build ──────────────────────────────────
# Stage 1: Build Go binary
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build (CGO_ENABLED=0 since we use PGX, not SQLite CGO)
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/docker-cost ./cmd/server

# Stage 2: Runtime
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

ENV TZ=Asia/Jakarta

WORKDIR /app

# Copy binary
COPY --from=builder /app/docker-cost .

# Copy frontend (only needed for server mode, harmless for agent)
COPY --from=builder /app/web/dist ./web/dist

# Volume for config & database (server mode only)
VOLUME ["/data"]

# Expose API port (server mode only)
EXPOSE 8080

# Default env
ENV PORT=8080
ENV DOCKER_COST_CONFIG_DIR=/data

# Labels for GitHub Container Registry
LABEL org.opencontainers.image.title="Container Cost"
LABEL org.opencontainers.image.description="Docker Container Cost Calculator — Agent & Central Server"
LABEL org.opencontainers.image.source="https://github.com/edsuwarna/container-cost"
LABEL org.opencontainers.image.licenses="MIT"

ENTRYPOINT ["/app/docker-cost"]
