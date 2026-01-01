// Package torm provides a Mongoose-style ORM client for ToonStore database
package torm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the main ToonStore ORM client
type Client struct {
	BaseURL string
	Timeout time.Duration
	client  *http.Client
}

// ClientOptions configuration for creating a new client
type ClientOptions struct {
	BaseURL string
	Timeout time.Duration
}

// NewClient creates a new TORM client
func NewClient(opts *ClientOptions) *Client {
	if opts == nil {
		opts = &ClientOptions{}
	}
	
	baseURL := opts.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:3001"
	}
	
	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	
	return &Client{
		BaseURL: baseURL,
		Timeout: timeout,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// Model creates a new model for the specified collection
func (c *Client) Model(name string, schema map[string]ValidationRule) *Model {
	return &Model{
		client:     c,
		name:       name,
		collection: name,
		schema:     schema,
		validate:   true,
	}
}

// Health checks server health
func (c *Client) Health() (map[string]interface{}, error) {
	resp, err := c.client.Get(c.BaseURL + "/health")
	if err != nil {
		return nil, fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode health response: %w", err)
	}
	
	return result, nil
}

// Info gets server information
func (c *Client) Info() (map[string]interface{}, error) {
	resp, err := c.client.Get(c.BaseURL + "/")
	if err != nil {
		return nil, fmt.Errorf("info request failed: %w", err)
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode info response: %w", err)
	}
	
	return result, nil
}

// request makes an HTTP request
func (c *Client) request(method, path string, body interface{}) (*http.Response, error) {
	url := c.BaseURL + path
	
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	
	return resp, nil
}
