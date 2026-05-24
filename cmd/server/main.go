package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/api"
	"github.com/endangsuwarna/docker-cost/internal/agent"
	"github.com/endangsuwarna/docker-cost/internal/calculator"
	"github.com/endangsuwarna/docker-cost/internal/collector"
	"github.com/endangsuwarna/docker-cost/internal/config"
	"github.com/endangsuwarna/docker-cost/internal/storage"
)

func main() {
	mode := flag.String("mode", "server", "Run mode: 'server' (central) or 'agent'")
	centralURL := flag.String("server", "", "Central server URL (agent mode: https://central:8081)")
	agentKey := flag.String("api-key", "", "Agent API key (agent mode)")
	pushInterval := flag.Int("push-interval", 60, "Push interval in seconds (agent mode)")
	flag.Parse()

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

	if *mode == "agent" {
		runAgentMode(cfg, configDir, *centralURL, *agentKey, *pushInterval)
	} else {
		runServerMode(cfg, configDir, cfgPath)
	}
}

func runServerMode(cfg config.VPSConfig, configDir, cfgPath string) {
	// --- Collector ---
	col, err := collector.New()
	if err != nil {
		log.Printf("Warning: Docker collector not available: %v", err)
		log.Println("Running in central server mode — no local Docker socket needed.")
	}

	// --- Database ---
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://docker-cost:***@localhost:5432/docker-cost?sslmode=disable"
	}
	store, err := storage.NewStore(dbURL)
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

	// --- Startup snapshot (only if local collector available) ---
	if col != nil && col.IsAvailable() {
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
	log.Printf("Docker Cost Calculator (SERVER MODE) starting on %s", addr)
	log.Printf("Config: %s", cfgPath)
	log.Printf("Database URL: %s", maskURL(dbURL))

	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func runAgentMode(cfg config.VPSConfig, configDir, centralURL, apiKey string, pushInterval int) {
	// Use CLI flags first, fall back to config file
	agentCfg, err := config.LoadAgentConfig(filepath.Join(configDir, "config.json"))
	if err == nil {
		if centralURL == "" {
			centralURL = agentCfg.CentralURL
		}
		if apiKey == "" {
			apiKey = agentCfg.AgentKey
		}
		if pushInterval <= 0 {
			pushInterval = agentCfg.PushInterval
		}
	}

	if centralURL == "" {
		log.Fatal("Agent mode requires --server flag or central_url in config")
	}
	if apiKey == "" {
		log.Fatal("Agent mode requires --api-key flag or agent_key in config")
	}
	if pushInterval <= 0 {
		pushInterval = 60
	}

	// --- Collector ---
	col, err := collector.New()
	if err != nil {
		log.Fatalf("Docker collector required for agent mode: %v", err)
	}

	// --- Calculator ---
	cal := calculator.New(cfg)

	// --- Agent Client ---
	retries := agentCfg.PushRetries
	if retries <= 0 {
		retries = 5
	}
	client := agent.NewClient(centralURL, apiKey, retries)

	collectFn := func() ([]calculator.CostReport, error) {
		stats, err := col.CollectStats()
		if err != nil {
			return nil, fmt.Errorf("collect failed: %w", err)
		}
		report := cal.CalculateReport(stats)
		return []calculator.CostReport{report}, nil
	}

	stop := make(chan struct{})
	log.Printf("Docker Cost Calculator (AGENT MODE) pushing to %s every %ds", centralURL, pushInterval)
	log.Printf("VPS: %s | CPU: %.0f | RAM: %.0fGB | Price: %.0f/month",
		cfg.Name, cfg.CPU, cfg.RAMGB, cfg.PricePerMonth)

	client.PushLoop(collectFn, time.Duration(pushInterval)*time.Second, stop)
}

// maskURL hides the password in a connection URL for logging
func maskURL(s string) string {
	start := 0
	for i := 0; i < len(s)-1; i++ {
		if s[i] == ':' && s[i+1] == '/' && s[i+2] == '/' {
			start = i + 3
			break
		}
	}
	for i := start; i < len(s); i++ {
		if s[i] == '@' {
			return s[:start] + "***" + s[i:]
		}
	}
	return s
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
