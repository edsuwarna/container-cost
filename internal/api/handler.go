package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/calculator"
	"github.com/endangsuwarna/docker-cost/internal/collector"
	"github.com/endangsuwarna/docker-cost/internal/config"
	"github.com/endangsuwarna/docker-cost/internal/storage"
)

// ─── Server ──────────────────────────────────────────

type Server struct {
	collector  *collector.Collector
	calculator *calculator.Calculator
	store      *storage.Store
	cfg        config.VPSConfig
	sessions   map[string]sessionInfo
	mu         sync.RWMutex
}

type sessionInfo struct {
	UserID    int          `json:"user_id"`
	Username  string       `json:"username"`
	Role      storage.Role `json:"role"`
	ExpiresAt time.Time    `json:"expires_at"`
}

func NewServer(
	col *collector.Collector,
	cal *calculator.Calculator,
	store *storage.Store,
	cfg config.VPSConfig,
) *Server {
	srv := &Server{
		collector:  col,
		calculator: cal,
		store:      store,
		cfg:        cfg,
		sessions:   make(map[string]sessionInfo),
	}
	if cfg.SecretKey == "" {
		buf := make([]byte, 32)
		rand.Read(buf)
		srv.cfg.SecretKey = hex.EncodeToString(buf)
	}
	return srv
}

// ─── Helpers ─────────────────────────────────────────

func generateToken() string {
	buf := make([]byte, 32)
	rand.Read(buf)
	return hex.EncodeToString(buf)
}

func (s *Server) isAuthenticated(r *http.Request) *sessionInfo {
	cookie, err := r.Cookie("session")
	if err != nil {
		return nil
	}
	s.mu.RLock()
	sess, ok := s.sessions[cookie.Value]
	s.mu.RUnlock()
	if !ok || time.Now().After(sess.ExpiresAt) {
		if ok {
			s.mu.Lock()
			delete(s.sessions, cookie.Value)
			s.mu.Unlock()
		}
		return nil
	}
	return &sess
}

// ─── Middleware ──────────────────────────────────────

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess := s.isAuthenticated(r)
		if sess == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "not authenticated"})
			return
		}
		next(w, r)
	}
}

func (s *Server) requireRole(roles ...storage.Role) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			sess := s.isAuthenticated(r)
			if sess == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "not authenticated"})
				return
			}
			allowed := false
			for _, role := range roles {
				if sess.Role == role {
					allowed = true
					break
				}
			}
			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
				return
			}
			next(w, r)
		}
	}
}

// ─── Auth Handlers ──────────────────────────────────

func (s *Server) handleAuthCheck(w http.ResponseWriter, r *http.Request) {
	sess := s.isAuthenticated(r)
	if sess != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"authenticated": true,
			"user":          sess.Username,
			"role":          sess.Role,
		})
	} else {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"authenticated": false,
		})
	}
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	user, err := s.store.AuthenticateUser(body.Username, body.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "auth error"})
		return
	}
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	token := generateToken()
	s.mu.Lock()
	s.sessions[token] = sessionInfo{
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	s.mu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   86400,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"user":    body.Username,
		"role":    user.Role,
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cookie, err := r.Cookie("session")
	if err == nil {
		s.mu.Lock()
		delete(s.sessions, cookie.Value)
		s.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]string{"success": "logged out"})
}

// ─── User Management (Admin only) ────────────────────

func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListUsers(w, r)
	case http.MethodPost:
		s.handleCreateUser(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleUserDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/users/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "user id required", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodDelete:
		s.handleDeleteUser(w, r, id)
	case http.MethodPut:
		if len(parts) > 1 && parts[1] == "reset-password" {
			s.handleResetPassword(w, r, id)
			return
		}
		s.handleUpdateUser(w, r, id)
	case http.MethodPost:
		if len(parts) > 1 && parts[1] == "reset-password" {
			s.handleResetPassword(w, r, id)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.store.ListUsers()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username    string       `json:"username"`
		Password    string       `json:"password"`
		DisplayName string       `json:"display_name"`
		Role        storage.Role `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if body.Username == "" || body.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username and password required"})
		return
	}

	user, err := s.store.CreateUser(body.Username, body.Password, body.DisplayName, body.Role)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request, id int) {
	sess := s.isAuthenticated(r)
	if sess != nil && sess.UserID == id {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot delete yourself"})
		return
	}

	if err := s.store.DeleteUser(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request, id int) {
	var body struct {
		DisplayName string       `json:"display_name"`
		Role        storage.Role `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if body.Role != "" {
		if err := s.store.UpdateUserRole(id, body.Role); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request, id int) {
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if body.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password required"})
		return
	}

	if err := s.store.UpdateUserPassword(id, body.Password); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "password updated"})
}

// ─── VPS Management (Admin only) ─────────────────────

func (s *Server) handleListVPS(w http.ResponseWriter, r *http.Request) {
	vpsList, err := s.store.ListVPS()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if vpsList == nil {
		vpsList = []storage.VPSAgent{}
	}
	writeJSON(w, http.StatusOK, vpsList)
}

func (s *Server) handleCreateVPS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		Name  string `json:"name"`
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}

	agent, err := s.store.CreateVPS(body.Name, body.Notes)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, agent)
}

func (s *Server) handleVPSDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/vps/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "vps id required", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "invalid vps id", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		agent, err := s.store.GetVPSByID(id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if agent == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "VPS not found"})
			return
		}

		// Get latest report
		report, _ := s.store.GetLatestSnapshotForVPS(id)

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"vps":    agent,
			"report": report,
		})

	case http.MethodPut:
		var body struct {
			Name  string `json:"name"`
			Notes string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if err := s.store.UpdateVPSAgent(id, body.Name, body.Notes); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})

	case http.MethodDelete:
		if err := s.store.DeleteVPS(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleResetVPSKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID: /api/vps/{id}/reset-key
	path := strings.TrimPrefix(r.URL.Path, "/api/vps/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[0] == "" {
		http.Error(w, "vps id required", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "invalid vps id", http.StatusBadRequest)
		return
	}

	key, err := s.store.RegenerateVPSKey(id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "key regenerated",
		"api_key": key,
	})
}

// ─── Agent Push Endpoint (no session auth — uses API key) ──

func (s *Server) handlePush(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Authenticate via API key in Authorization header
	auth := r.Header.Get("Authorization")
	if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing api key"})
		return
	}
	apiKey := strings.TrimPrefix(auth, "Bearer ")

	agent, err := s.store.GetVPSByAPIKey(apiKey)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "auth error"})
		return
	}
	if agent == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid api key"})
		return
	}

	// Decode report
	var report calculator.CostReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid report JSON"})
		return
	}

	// Update last seen
	s.store.UpdateVPSLastSeen(agent.ID)

	// Save snapshot linked to this VPS
	id, err := s.store.SaveSnapshotForVPS(agent.ID, report)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "accepted",
		"snapshot_id": id,
	})
}

// ─── Aggregated Dashboard ────────────────────────────

func (s *Server) handleAggregatedDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	agg, err := s.store.GetAggregatedReport()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if agg.TotalVPS == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"message": "no VPS agents registered yet",
			"vps_list": []interface{}{},
			"total_cost": 0,
			"total_vps": 0,
			"total_containers": 0,
		})
		return
	}
	writeJSON(w, http.StatusOK, agg)
}

// ─── Routes ─────────────────────────────────────────

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	// Auth (no auth)
	mux.HandleFunc("/api/auth/check", s.handleAuthCheck)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/auth/logout", s.handleLogout)

	// Health (no auth)
	mux.HandleFunc("/api/health", s.handleHealth)

	// Agent push (no session auth — uses API key)
	mux.HandleFunc("/api/v1/push", s.handlePush)

	// User management (admin only)
	mux.HandleFunc("/api/users", s.requireRole(storage.RoleAdmin)(s.handleUsers))
	mux.HandleFunc("/api/users/", s.requireRole(storage.RoleAdmin)(s.handleUserDetail))

	// VPS Management (admin only)
	mux.HandleFunc("/api/vps", s.requireRole(storage.RoleAdmin)(s.handleListVPS))
	mux.HandleFunc("/api/vps/", s.requireRole(storage.RoleAdmin)(s.handleVPSDetail))
	mux.HandleFunc("/api/vps/reset-key", s.requireRole(storage.RoleAdmin)(s.handleResetVPSKey))

	// Dashboard (any authenticated)
	mux.HandleFunc("/api/report/latest", s.requireAuth(s.handleLatestReport))
	mux.HandleFunc("/api/report/refresh", s.requireAuth(s.handleRefreshReport))
	mux.HandleFunc("/api/report/history", s.requireAuth(s.handleReportHistory))
	mux.HandleFunc("/api/config", s.requireAuth(s.handleConfig))
	mux.HandleFunc("/api/containers", s.requireAuth(s.handleContainers))
	mux.HandleFunc("/api/containers/", s.requireAuth(s.handleContainerDetail))
	mux.HandleFunc("/api/costs/trends", s.requireAuth(s.handleCostTrends))
	mux.HandleFunc("/api/dashboard", s.requireAuth(s.handleAggregatedDashboard))

	// Frontend
	mux.Handle("/", http.FileServer(http.Dir("./web/dist")))
}

// ─── Existing Handlers ───────────────────────────────

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
		"message":     "report generated",
		"snapshot_id": id,
		"report":      report,
	})
}

func (s *Server) handleReportHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

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
		sanitized := map[string]interface{}{
			"name":              s.cfg.Name,
			"price_per_month":   s.cfg.PricePerMonth,
			"cpu_cores":         s.cfg.CPU,
			"ram_gb":            s.cfg.RAMGB,
			"storage_gb":        s.cfg.StorageGB,
			"bandwidth_gb":      s.cfg.BandwidthGB,
			"currency":          s.cfg.Currency,
			"cpu_weight":        s.cfg.CPUWeight,
			"ram_weight":        s.cfg.RAMWeight,
			"storage_weight":    s.cfg.StorageWeight,
			"network_weight":    s.cfg.NetworkWeight,
			"overhead_percent":  s.cfg.OverheadPercent,
		}
		writeJSON(w, http.StatusOK, sanitized)
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
			"name":           cc.Container.Name,
			"image":          cc.Container.Image,
			"cpu_percent":    cc.Container.CPUPercent,
			"mem_usage_mb":   cc.Container.MemUsageMB,
			"mem_percent":    cc.Container.MemPercent,
			"cost_per_month": cc.TotalCost,
			"cpu_cost":       cc.CPUCost,
			"ram_cost":       cc.RAMCost,
			"status":         cc.Container.Status,
		})
	}
	writeJSON(w, http.StatusOK, containers)
}

func (s *Server) handleContainerDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

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

// ─── Cost Trends ─────────────────────────────────────

func (s *Server) handleCostTrends(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	since := time.Now().AddDate(0, 0, -30)
	reports, err := s.store.GetSnapshotHistory(since, 100)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	type dailyCost struct {
		Date       string  `json:"date"`
		TotalCost  float64 `json:"total_cost"`
		Containers int     `json:"containers"`
	}

	var trends []dailyCost
	seen := make(map[string]bool)

	for _, report := range reports {
		date := report.CreatedAt
		if date == "" {
			continue
		}
		if len(date) >= 10 {
			date = date[:10]
		}
		if seen[date] {
			continue
		}
		seen[date] = true
		trends = append(trends, dailyCost{
			Date:       date,
			TotalCost:  report.TotalCost,
			Containers: len(report.Containers),
		})
	}

	for i := 0; i < len(trends); i++ {
		for j := i + 1; j < len(trends); j++ {
			if trends[i].Date > trends[j].Date {
				trends[i], trends[j] = trends[j], trends[i]
			}
		}
	}

	total := 0.0
	if len(trends) > 0 {
		total = trends[len(trends)-1].TotalCost
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"trends":         trends,
		"current_month":  total,
		"budget":         s.cfg.PricePerMonth,
		"currency":       s.cfg.Currency,
		"vps_name":       s.cfg.Name,
	})
}

// ─── JSON Helper ─────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
