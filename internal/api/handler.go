package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/calculator"
	"github.com/endangsuwarna/docker-cost/internal/collector"
	"github.com/endangsuwarna/docker-cost/internal/config"
	"github.com/endangsuwarna/docker-cost/internal/storage"
)

// Server holds HTTP handlers and dependencies
type Server struct {
	collector  *collector.Collector
	calculator *calculator.Calculator
	store      *storage.Store
	cfg        config.VPSConfig
}

// NewServer creates a new API server
func NewServer(
	col *collector.Collector,
	cal *calculator.Calculator,
	store *storage.Store,
	cfg config.VPSConfig,
) *Server {
	return &Server{
		collector:  col,
		calculator: cal,
		store:      store,
		cfg:        cfg,
	}
}

// RegisterRoutes sets up all HTTP routes
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/report/latest", s.handleLatestReport)
	mux.HandleFunc("/api/report/refresh", s.handleRefreshReport)
	mux.HandleFunc("/api/report/history", s.handleReportHistory)
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/containers", s.handleContainers)
	mux.HandleFunc("/api/containers/", s.handleContainerDetail)

	// Frontend static files
	mux.Handle("/", http.FileServer(http.Dir("./web/dist")))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleLatestReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	report, err := s.store.GetLatestSnapshot()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if report == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"message": "no reports yet. POST /api/report/refresh to generate one.",
		})
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (s *Server) handleRefreshReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := s.collector.CollectStats()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed to collect stats",
			"details": err.Error(),
		})
		return
	}

	report := s.calculator.CalculateReport(stats)
	id, err := s.store.SaveSnapshot(report)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed to save report",
			"details": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":    "report generated",
		"snapshot_id": id,
		"report":     report,
	})
}

func (s *Server) handleReportHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Default: last 7 days
	since := time.Now().AddDate(0, 0, -7)
	if sinceParam := r.URL.Query().Get("since"); sinceParam != "" {
		if parsed, err := time.Parse(time.RFC3339, sinceParam); err == nil {
			since = parsed
		}
	}

	reports, err := s.store.GetSnapshotHistory(since, 100)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, reports)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.cfg)
	case http.MethodPut:
		var newCfg config.VPSConfig
		if err := json.NewDecoder(r.Body).Decode(&newCfg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		s.cfg = newCfg
		writeJSON(w, http.StatusOK, map[string]string{"status": "config updated"})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleContainers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	report, err := s.store.GetLatestSnapshot()
	if err != nil || report == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	containers := make([]map[string]interface{}, 0, len(report.Containers))
	for _, cc := range report.Containers {
		containers = append(containers, map[string]interface{}{
			"name":        cc.Container.Name,
			"image":       cc.Container.Image,
			"cpu_percent": cc.Container.CPUPercent,
			"mem_usage_mb": cc.Container.MemUsageMB,
			"mem_percent": cc.Container.MemPercent,
			"cost_per_month": cc.TotalCost,
			"cpu_cost":    cc.CPUCost,
			"ram_cost":    cc.RAMCost,
			"status":      cc.Container.Status,
		})
	}

	writeJSON(w, http.StatusOK, containers)
}

func (s *Server) handleContainerDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract container name from URL: /api/containers/{name}
	name := r.URL.Path[len("/api/containers/"):]
	if name == "" {
		http.Error(w, "container name required", http.StatusBadRequest)
		return
	}

	history, err := s.store.GetContainerHistory(name, 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, history)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
