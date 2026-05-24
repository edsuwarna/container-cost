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
	AdminPass      string  `json:"admin_pass"`
	SecretKey      string  `json:"secret_key"`
}

// AgentConfig holds configuration for agent mode
type AgentConfig struct {
	Mode       string `json:"mode"`        // "server" or "agent"
	CentralURL string `json:"central_url"` // e.g. "https://central:8081"
	AgentKey   string `json:"agent_key"`   // API key for agent auth
	PushInterval int  `json:"push_interval"` // seconds between pushes (default 60)
	PushRetries  int  `json:"push_retries"`  // retry count (default 5)
}

type FullConfig struct {
	VPS   VPSConfig   `json:"vps"`
	Agent AgentConfig `json:"agent"`
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
		AdminPass:       "",
		SecretKey:       "",
	}
}

func DefaultAgentConfig() AgentConfig {
	return AgentConfig{
		Mode:         "server",
		CentralURL:   "",
		AgentKey:     "",
		PushInterval: 60,
		PushRetries:  5,
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

	// Try loading as FullConfig first (new format)
	var full FullConfig
	if err := json.Unmarshal(data, &full); err == nil && full.VPS.Name != "" {
		return full.VPS, nil
	}

	// Fallback to legacy VPSConfig format
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("failed to parse config: %w", err)
	}
	return cfg, nil
}

func LoadAgentConfig(path string) (AgentConfig, error) {
	ac := DefaultAgentConfig()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ac, nil
		}
		return ac, fmt.Errorf("failed to read config: %w", err)
	}

	// Try FullConfig first
	var full FullConfig
	if err := json.Unmarshal(data, &full); err == nil {
		if full.Agent.Mode != "" {
			return full.Agent, nil
		}
	}

	return ac, nil
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
