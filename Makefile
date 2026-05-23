.PHONY: build run clean test deps

# Variables
BINARY_NAME=docker-cost
BUILD_DIR=build
GOFLAGS=-ldflags="-s -w"

all: build

deps:
	go mod tidy
	go mod download

build: deps
	mkdir -p $(BUILD_DIR)
	CGO_ENABLED=1 go build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server
	@echo "✅ Built: $(BUILD_DIR)/$(BINARY_NAME)"

build-static: deps
	mkdir -p $(BUILD_DIR)
	CGO_ENABLED=1 GOOS=linux go build $(GOFLAGS) -tags netgo -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server
	@echo "✅ Static build: $(BUILD_DIR)/$(BINARY_NAME)"

run: build
	./$(BUILD_DIR)/$(BINARY_NAME)

run-quick:
	PORT=8080 go run ./cmd/server

test:
	go test -v -race ./...

clean:
	rm -rf $(BUILD_DIR)
	rm -f docker-cost.db

# Install system dependencies (Debian/Ubuntu)
install-deps:
	sudo apt-get update && sudo apt-get install -y gcc libc6-dev sqlite3

info:
	@echo "Docker Cost Calculator"
	@echo "----------------------"
	@echo "Binary:   $(BUILD_DIR)/$(BINARY_NAME)"
	@echo "Config:   ~/.docker-cost/config.json"
	@echo "Database: ~/.docker-cost/docker-cost.db"
	@echo "Docs:     http://localhost:8080"
