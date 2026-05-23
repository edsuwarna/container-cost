package collector

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

// ContainerStat holds the resource usage for a single container
type ContainerStat struct {
	Name       string  `json:"name"`
	ID         string  `json:"id"`
	Image      string  `json:"image"`
	CPUPercent float64 `json:"cpu_percent"`
	MemUsageMB float64 `json:"mem_usage_mb"`
	MemLimitMB float64 `json:"mem_limit_mb"`
	MemPercent float64 `json:"mem_percent"`
	Status     string  `json:"status"`
	CreatedAt  string  `json:"created_at"`
	Uptime     string  `json:"uptime"`
}

// Collector collects Docker container stats via Docker socket
type Collector struct {
	client    *http.Client
	sockPath  string
	available bool
}

// New creates a new Docker collector
func New() (*Collector, error) {
	sockPath := os.Getenv("DOCKER_HOST")
	if sockPath == "" {
		sockPath = "/var/run/docker.sock"
	}

	// Check if socket exists
	if _, err := os.Stat(sockPath); os.IsNotExist(err) {
		return &Collector{available: false}, fmt.Errorf("docker socket not found at %s", sockPath)
	}

	client := &http.Client{
		Transport: &http.Transport{
			Dial: func(proto, addr string) (net.Conn, error) {
				return net.Dial("unix", sockPath)
			},
		},
		Timeout: 30 * time.Second,
	}

	// Verify connection
	resp, err := client.Get("http://localhost/_ping")
	if err != nil {
		return &Collector{available: false}, fmt.Errorf("cannot connect to docker socket: %w", err)
	}
	resp.Body.Close()

	return &Collector{
		client:    client,
		sockPath:  sockPath,
		available: true,
	}, nil
}

// IsAvailable returns whether Docker is accessible
func (c *Collector) IsAvailable() bool {
	return c.available
}

// CollectStats gathers live resource usage from all running containers
func (c *Collector) CollectStats() ([]ContainerStat, error) {
	if !c.available {
		return nil, fmt.Errorf("docker not available")
	}

	containers, err := c.listContainers()
	if err != nil {
		return nil, err
	}

	var stats []ContainerStat
	for _, cont := range containers {
		stat := ContainerStat{
			Name:  cont.getName(),
			ID:    cont.ID[:12],
			Image: cont.Image,
		}

		// Get detailed stats
		cs, err := c.getContainerStats(cont.ID)
		if err == nil {
			stat.CPUPercent = cs.calcCPU()
			stat.MemUsageMB = cs.calcMemUsage()
			stat.MemLimitMB = cs.calcMemLimit()
			stat.MemPercent = cs.calcMemPercent()
		}

		// Get container info (status, created)
		info, err := c.getContainerInfo(cont.ID)
		if err == nil {
			stat.Status = info.State.Status
			stat.CreatedAt = info.Created
		}

		stats = append(stats, stat)
	}

	return stats, nil
}

// --- Internal types matching Docker API ---

type dockerContainer struct {
	ID    string   `json:"Id"`
	Names []string `json:"Names"`
	Image string   `json:"Image"`
}

func (d dockerContainer) getName() string {
	if len(d.Names) == 0 {
		return d.ID[:12]
	}
	name := d.Names[0]
	if len(name) > 0 && name[0] == '/' {
		name = name[1:]
	}
	return name
}

type dockerStats struct {
	CPUStats    cpuStats    `json:"cpu_stats"`
	PreCPUStats cpuStats    `json:"precpu_stats"`
	MemoryStats memoryStats `json:"memory_stats"`
	Networks    map[string]networkStats `json:"networks"`
}

type cpuStats struct {
	CPUUsage       cpuUsage `json:"cpu_usage"`
	SystemUsage    uint64   `json:"system_cpu_usage"`
	OnlineCPUs     uint32   `json:"online_cpus"`
}

type cpuUsage struct {
	TotalUsage  uint64 `json:"total_usage"`
	PercpuUsage []uint64 `json:"percpu_usage"`
}

type memoryStats struct {
	Usage    uint64 `json:"usage"`
	Limit    uint64 `json:"limit"`
	MaxUsage uint64 `json:"max_usage"`
}

type networkStats struct {
	RxBytes uint64 `json:"rx_bytes"`
	TxBytes uint64 `json:"tx_bytes"`
}

func (s *dockerStats) calcCPU() float64 {
	if s.CPUStats.CPUUsage.TotalUsage == 0 || s.CPUStats.SystemUsage == 0 {
		return 0
	}
	if s.PreCPUStats.CPUUsage.TotalUsage == 0 || s.PreCPUStats.SystemUsage == 0 {
		return 0
	}

	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage - s.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(s.CPUStats.SystemUsage - s.PreCPUStats.SystemUsage)

	if sysDelta <= 0 || cpuDelta <= 0 {
		return 0
	}

	numCPUs := float64(s.CPUStats.OnlineCPUs)
	if numCPUs == 0 {
		numCPUs = 1
	}

	return (cpuDelta / sysDelta) * numCPUs * 100.0
}

func (s *dockerStats) calcMemUsage() float64 {
	return float64(s.MemoryStats.Usage) / 1024 / 1024
}

func (s *dockerStats) calcMemLimit() float64 {
	return float64(s.MemoryStats.Limit) / 1024 / 1024
}

func (s *dockerStats) calcMemPercent() float64 {
	if s.MemoryStats.Limit == 0 {
		return 0
	}
	return (float64(s.MemoryStats.Usage) / float64(s.MemoryStats.Limit)) * 100.0
}

type containerInfo struct {
	State   containerState `json:"State"`
	Created string         `json:"Created"`
}

type containerState struct {
	Status     string `json:"Status"`
	Running    bool   `json:"Running"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
}

// --- Docker API calls ---

func (c *Collector) listContainers() ([]dockerContainer, error) {
	resp, err := c.client.Get("http://localhost/containers/json?all=false")
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}
	defer resp.Body.Close()

	var containers []dockerContainer
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
		return nil, fmt.Errorf("failed to decode containers: %w", err)
	}
	return containers, nil
}

func (c *Collector) getContainerStats(id string) (*dockerStats, error) {
	resp, err := c.client.Get(fmt.Sprintf("http://localhost/containers/%s/stats?stream=false", id))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var stats dockerStats
	if err := json.Unmarshal(body, &stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

func (c *Collector) getContainerInfo(id string) (*containerInfo, error) {
	resp, err := c.client.Get(fmt.Sprintf("http://localhost/containers/%s/json", id))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var info containerInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}
