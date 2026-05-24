package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type VPSConfig struct {
	Name           string  `json:"name"`
	PricePerMonth  float64 `json:"price_per_month"`
	CPU            float64 `json:"cpu_cores"`
	RAMGB          float64 `json:"ram_gb"`
	StorageGB      float64 `json:"storage_gb"`
	BandwidthGB    float64 `json:"bandwidth_gb"`
	Currency       string  `json:"currency"`
	CPUWeight      float64 `json:"cpu_weight"`
	RAMWeight      float64 `json:"ram_weight"`
	StorageWeight  float64 `json:"storage_weight"`
	NetworkWeight  float64 `json:"network_weight"`
	OverheadPercent float64 `json:"overhead_percent"`
	AdminUser      string  `json:"admin_user"`
	AdminPass      string  `json:"admin_pass"` // bcrypt hash
	SecretKey      string  `json:"secret_key"` // for session signing
}

func DefaultConfig() VPSConfig {
	return VPSConfig{
		Name:            "My VPS",
		PricePerMonth:   200000,
		CPU:             4,
		RAMGB:           8,
		StorageGB:       100,
		BandwidthGB:     0,
		Currency:        "IDR",
		CPUWeight:       0.5,
		RAMWeight:       0.4,
		StorageWeight:   0.1,
		NetworkWeight:   0.0,
		OverheadPercent: 15.0,
		AdminUser:       "admin",
		AdminPass:       "", // set via env or first-run
		SecretKey:       "",
	}
}

func LoadConfig(path string) (VPSConfig, error) {
	cfg := DefaultConfig()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			if err := cfg.Save(path); err != nil {
				return cfg, fmt.Errorf("failed to create default config: %w", err)
			}
			return cfg, nil
		}
		return cfg, fmt.Errorf("failed to read config: %w", err)
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("failed to parse config: %w", err)
	}
	return cfg, nil
}

func (c VPSConfig) Save(path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}
