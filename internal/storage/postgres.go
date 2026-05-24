package storage

import (
	"database/sql"
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
		created_at TIMESTAMP DEFAULT NOW(),
		report_json JSONB NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_snapshots_created
		ON snapshots(created_at DESC);
	`
	_, err := s.db.Exec(schema)
	return err
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

	// Also create demo users
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
	// Check if user exists
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

// ─── Snapshot Methods ────────────────────────────────

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

// ─── Container History ───────────────────────────────

type ContainerCostPoint struct {
	Timestamp  time.Time `json:"timestamp"`
	Name       string    `json:"name"`
	CPUPercent float64   `json:"cpu_percent"`
	MemUsageMB float64   `json:"mem_usage_mb"`
	TotalCost  float64   `json:"total_cost"`
}

func (s *Store) GetContainerHistory(name string, limit int) ([]ContainerCostPoint, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.db.Query(
		"SELECT created_at, report_json FROM snapshots ORDER BY created_at DESC LIMIT $1",
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query container history: %w", err)
	}
	defer rows.Close()

	var points []ContainerCostPoint
	for rows.Next() {
		var ts string
		var reportJSON string
		if err := rows.Scan(&ts, &reportJSON); err != nil {
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
