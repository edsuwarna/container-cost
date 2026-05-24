package storage

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/calculator"
	"github.com/endangsuwarna/docker-cost/internal/collector"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

// ─── User ─────────────────────────────────────────────

type Role string

const (
	RoleAdmin       Role = "admin"
	RoleEngineer    Role = "engineer"
	RoleManagement  Role = "management"
)

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	Role         Role      `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

// ─── VPS Agent ────────────────────────────────────────

type VPSAgent struct {
	ID             int       `json:"id"`
	Name           string    `json:"name"`
	APIKey         string    `json:"api_key,omitempty"`
	CPU            float64   `json:"cpu_cores"`
	RAMGB          float64   `json:"ram_gb"`
	StorageGB      float64   `json:"storage_gb"`
	PricePerMonth  float64   `json:"price_per_month"`
	Currency       string    `json:"currency"`
	CPUWeight      float64   `json:"cpu_weight"`
	RAMWeight      float64   `json:"ram_weight"`
	StorageWeight  float64   `json:"storage_weight"`
	OverheadPercent float64  `json:"overhead_percent"`
	Notes          string    `json:"notes"`
	Status         string    `json:"status"` // "online", "offline"
	LastSeen       *time.Time `json:"last_seen"`
	CreatedAt      time.Time `json:"created_at"`
}

// ─── Store ────────────────────────────────────────────

type Store struct {
	db *sql.DB
}

func NewStore(databaseURL string) (*Store, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}
	if err := store.seed(); err != nil {
		return nil, fmt.Errorf("failed to seed data: %w", err)
	}

	return store, nil
}

func (s *Store) migrate() error {
	// Step 1: Create vps_agents table (new table, no dependency)
	vpsTable := `
	CREATE TABLE IF NOT EXISTS vps_agents (
		id SERIAL PRIMARY KEY,
		name VARCHAR(200) NOT NULL,
		api_key VARCHAR(128) UNIQUE NOT NULL,
		cpu DOUBLE PRECISION NOT NULL DEFAULT 0,
		ram_gb DOUBLE PRECISION NOT NULL DEFAULT 0,
		storage_gb DOUBLE PRECISION NOT NULL DEFAULT 0,
		price_per_month DOUBLE PRECISION NOT NULL DEFAULT 0,
		currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
		cpu_weight DOUBLE PRECISION NOT NULL DEFAULT 0.5,
		ram_weight DOUBLE PRECISION NOT NULL DEFAULT 0.4,
		storage_weight DOUBLE PRECISION NOT NULL DEFAULT 0.1,
		overhead_percent DOUBLE PRECISION NOT NULL DEFAULT 15.0,
		notes TEXT NOT NULL DEFAULT '',
		status VARCHAR(20) NOT NULL DEFAULT 'offline',
		last_seen TIMESTAMP,
		created_at TIMESTAMP DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_vps_agents_api_key
		ON vps_agents(api_key);

	CREATE INDEX IF NOT EXISTS idx_vps_agents_name
		ON vps_agents(name);
	`
	if _, err := s.db.Exec(vpsTable); err != nil {
		return fmt.Errorf("failed to create vps_agents: %w", err)
	}

	// Step 2: Create users & snapshots (existing tables, IF NOT EXISTS)
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username VARCHAR(100) UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		display_name VARCHAR(200) NOT NULL DEFAULT '',
		role VARCHAR(20) NOT NULL DEFAULT 'engineer',
		created_at TIMESTAMP DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS snapshots (
		id SERIAL PRIMARY KEY,
		vps_id INTEGER REFERENCES vps_agents(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT NOW(),
		report_json JSONB NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_snapshots_created
		ON snapshots(created_at DESC);
	`
	if _, err := s.db.Exec(schema); err != nil {
		return err
	}

	// Step 3: Add vps_id column to snapshots if it doesn't exist (for existing DBs)
	if _, err := s.db.Exec(`
		ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS vps_id INTEGER REFERENCES vps_agents(id) ON DELETE CASCADE
	`); err != nil {
		// If column already exists but FK constraint failed, that's fine
		return fmt.Errorf("failed to add vps_id to snapshots: %w", err)
	}

	// Step 4: Create index on vps_id if it doesn't exist
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_vps ON snapshots(vps_id, created_at DESC)`)

	return nil
}

// seed creates the default admin user if no users exist
func (s *Store) seed() error {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("change-me"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	_, err = s.db.Exec(
		`INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)`,
		"admin", string(hash), "Admin", RoleAdmin,
	)
	if err != nil {
		return fmt.Errorf("failed to create default admin: %w", err)
	}

	demoUsers := []struct {
		username, displayName string
		role                  Role
		password              string
	}{
		{"eng", "Engineer User", RoleEngineer, "change-me"},
		{"mgt", "Management User", RoleManagement, "change-me"},
	}
	for _, u := range demoUsers {
		h, _ := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		_, err = s.db.Exec(
			`INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)`,
			u.username, string(h), u.displayName, u.role,
		)
		if err != nil {
			return fmt.Errorf("failed to create user %s: %w", u.username, err)
		}
	}

	return nil
}

// ─── User Methods ────────────────────────────────────

func (s *Store) AuthenticateUser(username, password string) (*User, error) {
	user, err := s.GetUserByUsername(username)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil
	}
	return user, nil
}

func (s *Store) GetUserByUsername(username string) (*User, error) {
	row := s.db.QueryRow(
		`SELECT id, username, password_hash, display_name, role, created_at FROM users WHERE username = $1`,
		username,
	)

	var u User
	if err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}
	return &u, nil
}

func (s *Store) GetUserByID(id int) (*User, error) {
	row := s.db.QueryRow(
		`SELECT id, username, password_hash, display_name, role, created_at FROM users WHERE id = $1`,
		id,
	)

	var u User
	if err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}
	return &u, nil
}

func (s *Store) CreateUser(username, password, displayName string, role Role) (*User, error) {
	existing, err := s.GetUserByUsername(username)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("username already exists")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	var user User
	err = s.db.QueryRow(
		`INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)
		 RETURNING id, username, display_name, role, created_at`,
		username, string(hash), displayName, role,
	).Scan(&user.ID, &user.Username, &user.DisplayName, &user.Role, &user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return &user, nil
}

func (s *Store) ListUsers() ([]User, error) {
	rows, err := s.db.Query(
		`SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}
	return users, nil
}

func (s *Store) DeleteUser(id int) error {
	result, err := s.db.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *Store) UpdateUserRole(id int, role Role) error {
	result, err := s.db.Exec(`UPDATE users SET role = $1 WHERE id = $2`, role, id)
	if err != nil {
		return fmt.Errorf("failed to update user role: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *Store) UpdateUserPassword(id int, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	result, err := s.db.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), id)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// ─── VPS Agent Methods ───────────────────────────────

func generateAPIKey() string {
	buf := make([]byte, 32)
	rand.Read(buf)
	return "dckr_" + hex.EncodeToString(buf)
}

func (s *Store) CreateVPS(name string, notes string) (*VPSAgent, error) {
	key := generateAPIKey()
	agent := &VPSAgent{}
	err := s.db.QueryRow(
		`INSERT INTO vps_agents (name, api_key, notes) VALUES ($1, $2, $3)
		 RETURNING id, name, api_key, cpu, ram_gb, storage_gb, price_per_month, currency,
		           cpu_weight, ram_weight, storage_weight, overhead_percent,
		           notes, status, last_seen, created_at`,
		name, key, notes,
	).Scan(&agent.ID, &agent.Name, &agent.APIKey, &agent.CPU, &agent.RAMGB,
		&agent.StorageGB, &agent.PricePerMonth, &agent.Currency,
		&agent.CPUWeight, &agent.RAMWeight, &agent.StorageWeight, &agent.OverheadPercent,
		&agent.Notes, &agent.Status, &agent.LastSeen, &agent.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create VPS: %w", err)
	}
	return agent, nil
}

func (s *Store) ListVPS() ([]VPSAgent, error) {
	rows, err := s.db.Query(
		`SELECT id, name, cpu, ram_gb, storage_gb, price_per_month, currency,
		        cpu_weight, ram_weight, storage_weight, overhead_percent,
		        notes, status, last_seen, created_at
		 FROM vps_agents ORDER BY name`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list VPS: %w", err)
	}
	defer rows.Close()

	var agents []VPSAgent
	for rows.Next() {
		var a VPSAgent
		if err := rows.Scan(&a.ID, &a.Name, &a.CPU, &a.RAMGB,
			&a.StorageGB, &a.PricePerMonth, &a.Currency,
			&a.CPUWeight, &a.RAMWeight, &a.StorageWeight, &a.OverheadPercent,
			&a.Notes, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
			continue
		}
		agents = append(agents, a)
	}
	return agents, nil
}

func (s *Store) GetVPSByID(id int) (*VPSAgent, error) {
	row := s.db.QueryRow(
		`SELECT id, name, api_key, cpu, ram_gb, storage_gb, price_per_month, currency,
		        cpu_weight, ram_weight, storage_weight, overhead_percent,
		        notes, status, last_seen, created_at
		 FROM vps_agents WHERE id = $1`,
		id,
	)
	var a VPSAgent
	if err := row.Scan(&a.ID, &a.Name, &a.APIKey, &a.CPU, &a.RAMGB,
		&a.StorageGB, &a.PricePerMonth, &a.Currency,
		&a.CPUWeight, &a.RAMWeight, &a.StorageWeight, &a.OverheadPercent,
		&a.Notes, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query VPS: %w", err)
	}
	return &a, nil
}

func (s *Store) GetVPSByAPIKey(apiKey string) (*VPSAgent, error) {
	row := s.db.QueryRow(
		`SELECT id, name, api_key, cpu, ram_gb, storage_gb, price_per_month, currency,
		        cpu_weight, ram_weight, storage_weight, overhead_percent,
		        notes, status, last_seen, created_at
		 FROM vps_agents WHERE api_key = $1`,
		apiKey,
	)
	var a VPSAgent
	if err := row.Scan(&a.ID, &a.Name, &a.APIKey, &a.CPU, &a.RAMGB,
		&a.StorageGB, &a.PricePerMonth, &a.Currency,
		&a.CPUWeight, &a.RAMWeight, &a.StorageWeight, &a.OverheadPercent,
		&a.Notes, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query VPS by API key: %w", err)
	}
	return &a, nil
}

func (s *Store) UpdateVPSLastSeen(id int) error {
	_, err := s.db.Exec(
		`UPDATE vps_agents SET last_seen = NOW(), status = 'online' WHERE id = $1`,
		id,
	)
	return err
}

func (s *Store) UpdateVPSAgent(id int, name, notes string) error {
	_, err := s.db.Exec(
		`UPDATE vps_agents SET name = $1, notes = $2 WHERE id = $3`,
		name, notes, id,
	)
	return err
}

func (s *Store) RegenerateVPSKey(id int) (string, error) {
	key := generateAPIKey()
	_, err := s.db.Exec(
		`UPDATE vps_agents SET api_key = $1 WHERE id = $2`,
		key, id,
	)
	if err != nil {
		return "", err
	}
	return key, nil
}

func (s *Store) DeleteVPS(id int) error {
	// Delete all snapshots for this VPS first (cascade should handle it)
	_, err := s.db.Exec(`DELETE FROM vps_agents WHERE id = $1`, id)
	return err
}

// MarkVPSOffline marks VPS agents as offline if not seen for a duration
func (s *Store) MarkVPSOffline(duration time.Duration) error {
	cutoff := time.Now().Add(-duration)
	_, err := s.db.Exec(
		`UPDATE vps_agents SET status = 'offline' WHERE last_seen IS NULL OR last_seen < $1`,
		cutoff,
	)
	return err
}

// ─── Snapshot Methods (updated for multi-VPS) ────────

func (s *Store) SaveSnapshot(report calculator.CostReport) (int64, error) {
	report.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	data, err := json.Marshal(report)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal report: %w", err)
	}

	var id int64
	err = s.db.QueryRow(
		`INSERT INTO snapshots (created_at, report_json) VALUES ($1, $2) RETURNING id`,
		report.CreatedAt,
		string(data),
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("failed to insert snapshot: %w", err)
	}
	return id, nil
}

// SaveSnapshotForVPS saves a snapshot linked to a specific VPS agent
func (s *Store) SaveSnapshotForVPS(vpsID int, report calculator.CostReport) (int64, error) {
	report.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	data, err := json.Marshal(report)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal report: %w", err)
	}

	var id int64
	err = s.db.QueryRow(
		`INSERT INTO snapshots (vps_id, created_at, report_json) VALUES ($1, $2, $3) RETURNING id`,
		vpsID,
		report.CreatedAt,
		string(data),
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("failed to insert snapshot: %w", err)
	}
	return id, nil
}

func (s *Store) GetLatestSnapshot() (*calculator.CostReport, error) {
	row := s.db.QueryRow(
		"SELECT report_json FROM snapshots ORDER BY created_at DESC LIMIT 1",
	)

	var reportJSON string
	if err := row.Scan(&reportJSON); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query latest snapshot: %w", err)
	}

	var report calculator.CostReport
	if err := json.Unmarshal([]byte(reportJSON), &report); err != nil {
		return nil, fmt.Errorf("failed to unmarshal report: %w", err)
	}
	return &report, nil
}

// GetLatestSnapshotForVPS returns the latest snapshot for a specific VPS
func (s *Store) GetLatestSnapshotForVPS(vpsID int) (*calculator.CostReport, error) {
	row := s.db.QueryRow(
		"SELECT report_json FROM snapshots WHERE vps_id = $1 ORDER BY created_at DESC LIMIT 1",
		vpsID,
	)

	var reportJSON string
	if err := row.Scan(&reportJSON); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query latest VPS snapshot: %w", err)
	}

	var report calculator.CostReport
	if err := json.Unmarshal([]byte(reportJSON), &report); err != nil {
		return nil, fmt.Errorf("failed to unmarshal report: %w", err)
	}
	return &report, nil
}

func (s *Store) GetSnapshotHistory(since time.Time, limit int) ([]calculator.CostReport, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := s.db.Query(
		"SELECT created_at, report_json FROM snapshots WHERE created_at >= $1 ORDER BY created_at DESC LIMIT $2",
		since.Format(time.RFC3339),
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query snapshot history: %w", err)
	}
	defer rows.Close()

	var reports []calculator.CostReport
	for rows.Next() {
		var ts, reportJSON string
		if err := rows.Scan(&ts, &reportJSON); err != nil {
			continue
		}
		var report calculator.CostReport
		if err := json.Unmarshal([]byte(reportJSON), &report); err != nil {
			continue
		}
		if report.CreatedAt == "" {
			report.CreatedAt = ts
		}
		reports = append(reports, report)
	}
	return reports, nil
}

// ─── Aggregated Report ───────────────────────────────

// AggregatedReport combines cost data from all VPS
type AggregatedReport struct {
	VPSList      []VPSAgent              `json:"vps_list"`
	Reports      []calculator.CostReport `json:"reports"`
	TotalCost    float64                 `json:"total_cost"`
	TotalVPS     int                     `json:"total_vps"`
	TotalContainers int                  `json:"total_containers"`
	Currency     string                  `json:"currency"`
	UpdatedAt    string                  `json:"updated_at"`
}

func (s *Store) GetAggregatedReport() (*AggregatedReport, error) {
	agents, err := s.ListVPS()
	if err != nil {
		return nil, err
	}

	agg := &AggregatedReport{
		VPSList:   agents,
		TotalVPS:  len(agents),
		Currency:  "IDR",
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	for _, agent := range agents {
		report, err := s.GetLatestSnapshotForVPS(agent.ID)
		if err != nil || report == nil {
			continue
		}
		agg.Reports = append(agg.Reports, *report)
		agg.TotalCost += report.TotalCost
		agg.TotalContainers += len(report.Containers)
		if report.VPS.Currency != "" {
			agg.Currency = report.VPS.Currency
		}
	}

	return agg, nil
}

// ─── Container History ───────────────────────────────

type ContainerCostPoint struct {
	Timestamp  time.Time `json:"timestamp"`
	Name       string    `json:"name"`
	VPSName    string    `json:"vps_name,omitempty"`
	CPUPercent float64   `json:"cpu_percent"`
	MemUsageMB float64   `json:"mem_usage_mb"`
	TotalCost  float64   `json:"total_cost"`
}

func (s *Store) GetContainerHistory(name string, limit int) ([]ContainerCostPoint, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.db.Query(
		`SELECT s.created_at, s.report_json, COALESCE(v.name, '') as vps_name
		 FROM snapshots s
		 LEFT JOIN vps_agents v ON s.vps_id = v.id
		 ORDER BY s.created_at DESC LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query container history: %w", err)
	}
	defer rows.Close()

	var points []ContainerCostPoint
	for rows.Next() {
		var ts, reportJSON, vpsName string
		if err := rows.Scan(&ts, &reportJSON, &vpsName); err != nil {
			continue
		}
		var report calculator.CostReport
		if err := json.Unmarshal([]byte(reportJSON), &report); err != nil {
			continue
		}
		for _, cont := range report.Containers {
			if cont.Container.Name == name {
				t, _ := time.Parse(time.RFC3339, ts)
				points = append(points, ContainerCostPoint{
					Timestamp:  t,
					Name:       cont.Container.Name,
					VPSName:    vpsName,
					CPUPercent: cont.Container.CPUPercent,
					MemUsageMB: cont.Container.MemUsageMB,
					TotalCost:  cont.TotalCost,
				})
			}
		}
	}
	return points, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

var _ = collector.ContainerStat{}
