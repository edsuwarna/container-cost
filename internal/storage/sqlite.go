package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/calculator"
	"github.com/endangsuwarna/docker-cost/internal/collector"
	_ "github.com/mattn/go-sqlite3"
)

// Store handles all database operations
type Store struct {
	db *sql.DB
}

// NewStore opens/creates the SQLite database
func NewStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000")
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

	return store, nil
}

// migrate creates tables if they don't exist
func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		report_json TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_snapshots_created 
		ON snapshots(created_at DESC);
	`
	_, err := s.db.Exec(schema)
	return err
}

// SaveSnapshot stores a cost report
func (s *Store) SaveSnapshot(report calculator.CostReport) (int64, error) {
	data, err := json.Marshal(report)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal report: %w", err)
	}

	result, err := s.db.Exec(
		"INSERT INTO snapshots (created_at, report_json) VALUES (?, ?)",
		time.Now().UTC().Format(time.RFC3339),
		string(data),
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert snapshot: %w", err)
	}

	return result.LastInsertId()
}

// GetLatestSnapshot returns the most recent cost report
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

// GetSnapshotHistory returns cost reports within a time range
func (s *Store) GetSnapshotHistory(since time.Time, limit int) ([]calculator.CostReport, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := s.db.Query(
		"SELECT report_json FROM snapshots WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?",
		since.Format(time.RFC3339),
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query snapshot history: %w", err)
	}
	defer rows.Close()

	var reports []calculator.CostReport
	for rows.Next() {
		var reportJSON string
		if err := rows.Scan(&reportJSON); err != nil {
			continue
		}
		var report calculator.CostReport
		if err := json.Unmarshal([]byte(reportJSON), &report); err != nil {
			continue
		}
		reports = append(reports, report)
	}

	return reports, nil
}

// GetContainerHistory returns historical cost data for a specific container
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
		"SELECT created_at, report_json FROM snapshots ORDER BY created_at DESC LIMIT ?",
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

// Close closes the database connection
func (s *Store) Close() error {
	return s.db.Close()
}

// Ensure interfaces are satisfied
var _ = collector.ContainerStat{}
