package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/calculator"
)

// Client pushes cost reports to a central server
type Client struct {
	centralURL  string
	apiKey      string
	httpClient  *http.Client
	pushRetries int
	pushDelay   time.Duration
}

// NewClient creates a new agent client
func NewClient(centralURL, apiKey string, retries int) *Client {
	return &Client{
		centralURL:  centralURL,
		apiKey:      apiKey,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
		pushRetries: retries,
		pushDelay:   10 * time.Second,
	}
}

// PushReport sends a cost report to the central server
func (c *Client) PushReport(report calculator.CostReport) error {
	if c.centralURL == "" || c.apiKey == "" {
		return fmt.Errorf("agent not configured: central_url or api_key missing")
	}

	body, err := json.Marshal(report)
	if err != nil {
		return fmt.Errorf("failed to marshal report: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/push", c.centralURL)

	var lastErr error
	for i := 0; i <= c.pushRetries; i++ {
		if i > 0 {
			log.Printf("[agent] retry %d/%d after %v...", i, c.pushRetries, c.pushDelay)
			time.Sleep(c.pushDelay)
		}

		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("push request failed: %w", err)
			continue
		}

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
			resp.Body.Close()
			return nil
		}

		var errBody struct {
			Error string `json:"error"`
		}
		json.NewDecoder(resp.Body).Decode(&errBody)
		resp.Body.Close()

		lastErr = fmt.Errorf("push rejected (HTTP %d): %s", resp.StatusCode, errBody.Error)
	}

	return fmt.Errorf("push failed after %d retries: %w", c.pushRetries, lastErr)
}

// PushLoop runs the agent push loop: collect → calculate → push → sleep
func (c *Client) PushLoop(
	collectFn func() ([]calculator.CostReport, error),
	interval time.Duration,
	stop chan struct{},
) {
	log.Printf("[agent] starting push loop every %v → %s", interval, c.centralURL)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Push immediately on start
	if reports, err := collectFn(); err == nil {
		for _, report := range reports {
			if err := c.PushReport(report); err != nil {
				log.Printf("[agent] initial push failed: %v", err)
			} else {
				log.Printf("[agent] initial push success: VPS=%s containers=%d cost=%.2f",
					report.VPS.Name, len(report.Containers), report.TotalCost)
			}
		}
	} else {
		log.Printf("[agent] initial collect failed: %v", err)
	}

	for {
		select {
		case <-stop:
			log.Println("[agent] push loop stopped")
			return
		case <-ticker.C:
			reports, err := collectFn()
			if err != nil {
				log.Printf("[agent] collect failed: %v", err)
				continue
			}
			for _, report := range reports {
				if err := c.PushReport(report); err != nil {
					log.Printf("[agent] push failed: %v", err)
				} else {
					log.Printf("[agent] push success: VPS=%s containers=%d cost=%.2f",
						report.VPS.Name, len(report.Containers), report.TotalCost)
				}
			}
		}
	}
}
