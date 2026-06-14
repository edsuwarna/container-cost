package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/endangsuwarna/docker-cost/internal/collector"
)

// RawPushPayload is sent by agents to the central server
type RawPushPayload struct {
	Containers []collector.ContainerStat `json:"containers"`
}

// Client pushes raw container stats to a central server
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

// PushStats sends raw container stats to the central server
func (c *Client) PushStats(stats []collector.ContainerStat) error {
	if c.centralURL == "" || c.apiKey == "" {
		return fmt.Errorf("agent not configured: central_url or api_key missing")
	}

	payload := RawPushPayload{Containers: stats}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal stats: %w", err)
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

// PushLoop runs the agent push loop: collect → push → sleep
func (c *Client) PushLoop(
	collectFn func() ([]collector.ContainerStat, error),
	interval time.Duration,
	stop chan struct{},
) {
	log.Printf("[agent] starting push loop every %v → %s", interval, c.centralURL)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Push immediately on start
	if stats, err := collectFn(); err == nil {
		if err := c.PushStats(stats); err != nil {
			log.Printf("[agent] initial push failed: %v", err)
		} else {
			log.Printf("[agent] initial push success: containers=%d", len(stats))
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
			stats, err := collectFn()
			if err != nil {
				log.Printf("[agent] collect failed: %v", err)
				continue
			}
			if err := c.PushStats(stats); err != nil {
				log.Printf("[agent] push failed: %v", err)
			} else {
				log.Printf("[agent] push success: containers=%d", len(stats))
			}
		}
	}
}
