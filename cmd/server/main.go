package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/endangsuwarna/docker-cost/internal/api"
	"github.com/endangsuwarna/docker-cost/internal/calculator"
	"github.com/endangsuwarna/docker-cost/internal/collector"
	"github.com/endangsuwarna/docker-cost/internal/config"
	"github.com/endangsuwarna/docker-cost/internal/storage"
)

func main() {
	// --- Config ---
	configDir := os.Getenv("DOCKER_COST_CONFIG_DIR")
	if configDir == "" {
		home, _ := os.UserHomeDir()
		configDir = filepath.Join(home, ".docker-cost")
	}

	cfgPath := filepath.Join(configDir, "config.json")
	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// --- Collector ---
	col, err := collector.New()
	if err != nil {
		log.Printf("Warning: Docker collector not available: %v", err)
		log.Println("Falling back to socket-based collection...")
	}

	// --- Database ---
	dbPath := filepath.Join(configDir, "docker-cost.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer store.Close()

	// --- Calculator ---
	cal := calculator.New(cfg)

	// --- Server ---
	srv := api.NewServer(col, cal, store, cfg)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	// --- Startup snapshot ---
	if col != nil {
		stats, err := col.CollectStats()
		if err == nil {
			report := cal.CalculateReport(stats)
			if id, err := store.SaveSnapshot(report); err == nil {
				log.Printf("Initial snapshot saved (id=%d)", id)
			}
		}
	}

	// --- Start HTTP ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Docker Cost Calculator starting on %s", addr)
	log.Printf("Config: %s", cfgPath)
	log.Printf("Database: %s", dbPath)

	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// withCORS wraps a handler with permissive CORS for dev
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
