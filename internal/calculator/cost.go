package calculator

import (
	"math"

	"github.com/endangsuwarna/docker-cost/internal/collector"
	"github.com/endangsuwarna/docker-cost/internal/config"
)

// ContainerCost holds cost breakdown for a single container
type ContainerCost struct {
	Container  collector.ContainerStat `json:"container"`
	CPUCost    float64                 `json:"cpu_cost"`
	RAMCost    float64                 `json:"ram_cost"`
	StorageCost float64                `json:"storage_cost"`
	TotalCost  float64                 `json:"total_cost"`
}

// CostReport contains the full cost breakdown
type CostReport struct {
	VPS             VPSInfo                    `json:"vps"`
	Containers      []ContainerCost            `json:"containers"`
	OverheadCost    float64                    `json:"overhead_cost"`
	UnallocatedCost float64                    `json:"unallocated_cost"`
	TotalCost       float64                    `json:"total_cost"`
	Period          string                     `json:"period"`
	CreatedAt       string                     `json:"created_at,omitempty"`
}

type VPSInfo struct {
	Name         string  `json:"name"`
	PricePerMonth float64 `json:"price_per_month"`
	CPU          float64 `json:"cpu_cores"`
	RAMGB        float64 `json:"ram_gb"`
	Currency     string  `json:"currency"`
}

// Calculator computes container-level cost allocation
type Calculator struct {
	cfg config.VPSConfig
}

// New creates a new cost calculator
func New(cfg config.VPSConfig) *Calculator {
	return &Calculator{cfg: cfg}
}

// CalculateReport computes cost allocation for all containers
func (cal *Calculator) CalculateReport(stats []collector.ContainerStat) CostReport {
	// Available resources after OS/Docker overhead
	overhead := cal.cfg.OverheadPercent / 100.0
	availCPU := cal.cfg.CPU * (1 - overhead)
	availRAM := cal.cfg.RAMGB * (1 - overhead)

	// Total resources used by containers
	var totalCPU, totalRAM float64
	containerCosts := make([]ContainerCost, 0, len(stats))

	for _, s := range stats {
		// Normalize CPU: docker stats gives %, convert to cores
		cpuCores := s.CPUPercent / 100.0

		// Calculate weighted costs
		cpuFraction := safeDivide(cpuCores, availCPU)
		ramFraction := safeDivide(s.MemUsageMB/1024, availRAM)

		// Apply weights
		totalWeight := cal.cfg.CPUWeight + cal.cfg.RAMWeight + cal.cfg.StorageWeight
		if totalWeight == 0 {
			totalWeight = 1.0 // prevent division by zero
		}

		// Monthly cost allocation
		cpuCost := cal.cfg.PricePerMonth * cal.cfg.CPUWeight * cpuFraction / totalWeight
		ramCost := cal.cfg.PricePerMonth * cal.cfg.RAMWeight * ramFraction / totalWeight

		// Storage: allocate equally per container if disk usage unknown
		storageFraction := safeDivide(1.0, float64(len(stats)))
		storageCost := cal.cfg.PricePerMonth * cal.cfg.StorageWeight * storageFraction / totalWeight

		cc := ContainerCost{
			Container:   s,
			CPUCost:     round2(cpuCost),
			RAMCost:     round2(ramCost),
			StorageCost: round2(storageCost),
			TotalCost:   round2(cpuCost + ramCost + storageCost),
		}
		containerCosts = append(containerCosts, cc)
		totalCPU += cpuCores
		totalRAM += s.MemUsageMB
	}

	// Calculate overhead cost
	overheadCPU := cal.cfg.CPU * overhead
	overheadRAM := cal.cfg.RAMGB * overhead
	overheadFraction := (overheadCPU/cal.cfg.CPU + overheadRAM/cal.cfg.RAMGB) / 2
	overheadCost := cal.cfg.PricePerMonth * overheadFraction

	// Unallocated resources
	usedCPUCores := totalCPU
	usedRAMGB := totalRAM / 1024
	unallocCPU := (availCPU - usedCPUCores) / availCPU
	unallocRAM := (availRAM - usedRAMGB) / availRAM
	unallocFraction := (math.Max(0, unallocCPU) + math.Max(0, unallocRAM)) / 2
	unallocCost := cal.cfg.PricePerMonth * unallocFraction

	return CostReport{
		VPS: VPSInfo{
			Name:          cal.cfg.Name,
			PricePerMonth: cal.cfg.PricePerMonth,
			CPU:           cal.cfg.CPU,
			RAMGB:         cal.cfg.RAMGB,
			Currency:      cal.cfg.Currency,
		},
		Containers:       containerCosts,
		OverheadCost:     round2(overheadCost),
		UnallocatedCost:  round2(unallocCost),
		TotalCost:        cal.cfg.PricePerMonth,
		Period:           "month",
	}
}

func safeDivide(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
