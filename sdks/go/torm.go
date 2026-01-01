// Package torm provides a Mongoose-style ORM for ToonStore
package torm

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
)

// Client is the TORM client for connecting to ToonStore
type Client struct {
	baseURL string
	client  *resty.Client
}

// NewClient creates a new TORM client
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:3001"
	}

	return &Client{
		baseURL: baseURL,
		client:  resty.New().SetBaseURL(baseURL).SetTimeout(30 * time.Second),
	}
}

// Model represents a base model interface
type Model interface {
	GetID() string
	SetID(string)
	ToMap() map[string]interface{}
}

// Collection provides CRUD operations for a model
type Collection[T Model] struct {
	client     *Client
	collection string
	factory    func() T
}

// NewCollection creates a new collection handler
func NewCollection[T Model](client *Client, collection string, factory func() T) *Collection[T] {
	return &Collection[T]{
		client:     client,
		collection: collection,
		factory:    factory,
	}
}

// Create creates a new document
func (c *Collection[T]) Create(data T) (T, error) {
	var result T

	resp, err := c.client.client.R().
		SetBody(map[string]interface{}{"data": data.ToMap()}).
		SetResult(&struct {
			Success bool                   `json:"success"`
			ID      string                 `json:"id"`
			Data    map[string]interface{} `json:"data"`
		}{}).
		Post(fmt.Sprintf("/api/%s", c.collection))

	if err != nil {
		return result, err
	}

	if !resp.IsSuccess() {
		return result, fmt.Errorf("failed to create document: %s", resp.Status())
	}

	// Parse response
	var response struct {
		Success bool                   `json:"success"`
		ID      string                 `json:"id"`
		Data    map[string]interface{} `json:"data"`
	}

	if err := json.Unmarshal(resp.Body(), &response); err != nil {
		return result, err
	}

	// Convert back to model
	jsonData, _ := json.Marshal(response.Data)
	result = c.factory()
	if err := json.Unmarshal(jsonData, &result); err != nil {
		return result, err
	}

	return result, nil
}

// FindByID finds a document by ID
func (c *Collection[T]) FindByID(id string) (T, error) {
	var result T

	resp, err := c.client.client.R().
		SetResult(&map[string]interface{}{}).
		Get(fmt.Sprintf("/api/%s/%s", c.collection, id))

	if err != nil {
		return result, err
	}

	if resp.StatusCode() == 404 {
		return result, fmt.Errorf("document not found")
	}

	if !resp.IsSuccess() {
		return result, fmt.Errorf("failed to find document: %s", resp.Status())
	}

	result = c.factory()
	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return result, err
	}

	return result, nil
}

// Find finds all documents matching filters
func (c *Collection[T]) Find(filters map[string]interface{}) ([]T, error) {
	var response struct {
		Collection string                   `json:"collection"`
		Count      int                      `json:"count"`
		Documents  []map[string]interface{} `json:"documents"`
	}

	var resp *resty.Response
	var err error

	if filters != nil {
		resp, err = c.client.client.R().
			SetBody(map[string]interface{}{"filters": filters}).
			SetResult(&response).
			Post(fmt.Sprintf("/api/%s/query", c.collection))
	} else {
		resp, err = c.client.client.R().
			SetResult(&response).
			Get(fmt.Sprintf("/api/%s", c.collection))
	}

	if err != nil {
		return nil, err
	}

	if !resp.IsSuccess() {
		return nil, fmt.Errorf("failed to find documents: %s", resp.Status())
	}

	// Parse response
	if err := json.Unmarshal(resp.Body(), &response); err != nil {
		return nil, err
	}

	// Convert to models
	results := make([]T, 0, len(response.Documents))
	for _, doc := range response.Documents {
		jsonData, _ := json.Marshal(doc)
		model := c.factory()
		if err := json.Unmarshal(jsonData, &model); err != nil {
			continue
		}
		results = append(results, model)
	}

	return results, nil
}

// Count counts documents in collection
func (c *Collection[T]) Count() (int, error) {
	var response struct {
		Collection string `json:"collection"`
		Count      int    `json:"count"`
	}

	resp, err := c.client.client.R().
		SetResult(&response).
		Get(fmt.Sprintf("/api/%s/count", c.collection))

	if err != nil {
		return 0, err
	}

	if !resp.IsSuccess() {
		return 0, fmt.Errorf("failed to count documents: %s", resp.Status())
	}

	if err := json.Unmarshal(resp.Body(), &response); err != nil {
		return 0, err
	}

	return response.Count, nil
}

// Save saves a document
func (c *Collection[T]) Save(model T) error {
	id := model.GetID()
	data := model.ToMap()

	var resp *resty.Response
	var err error

	if id != "" {
		resp, err = c.client.client.R().
			SetBody(map[string]interface{}{"data": data}).
			Put(fmt.Sprintf("/api/%s/%s", c.collection, id))
	} else {
		resp, err = c.client.client.R().
			SetBody(map[string]interface{}{"data": data}).
			Post(fmt.Sprintf("/api/%s", c.collection))

		if err == nil && resp.IsSuccess() {
			var result struct {
				ID string `json:"id"`
			}
			if err := json.Unmarshal(resp.Body(), &result); err == nil {
				model.SetID(result.ID)
			}
		}
	}

	if err != nil {
		return err
	}

	if !resp.IsSuccess() {
		return fmt.Errorf("failed to save document: %s", resp.Status())
	}

	return nil
}

// Delete deletes a document
func (c *Collection[T]) Delete(id string) error {
	resp, err := c.client.client.R().
		Delete(fmt.Sprintf("/api/%s/%s", c.collection, id))

	if err != nil {
		return err
	}

	if !resp.IsSuccess() {
		return fmt.Errorf("failed to delete document: %s", resp.Status())
	}

	return nil
}

// Migration represents a database migration
type Migration struct {
	ID   string
	Name string
	Up   func(*Client) error
	Down func(*Client) error
}

// MigrationManager manages database migrations
type MigrationManager struct {
	client     *Client
	migrations []Migration
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(client *Client) *MigrationManager {
	return &MigrationManager{
		client:     client,
		migrations: make([]Migration, 0),
	}
}

// AddMigration adds a migration
func (m *MigrationManager) AddMigration(migration Migration) {
	m.migrations = append(m.migrations, migration)
}

// Migrate runs all pending migrations
func (m *MigrationManager) Migrate() ([]string, error) {
	applied, err := m.getAppliedMigrations()
	if err != nil {
		return nil, err
	}

	newlyApplied := make([]string, 0)

	for _, migration := range m.migrations {
		if _, exists := applied[migration.ID]; !exists {
			// Run migration
			if err := migration.Up(m.client); err != nil {
				return newlyApplied, err
			}

			// Record migration
			if err := m.saveMigration(map[string]interface{}{
				"id":         migration.ID,
				"name":       migration.Name,
				"applied_at": time.Now().Format(time.RFC3339),
			}); err != nil {
				return newlyApplied, err
			}

			newlyApplied = append(newlyApplied, migration.Name)
		}
	}

	return newlyApplied, nil
}

// Rollback rolls back last N migrations
func (m *MigrationManager) Rollback(steps int) ([]string, error) {
	applied, err := m.getAppliedMigrations()
	if err != nil {
		return nil, err
	}

	// Sort by applied_at descending
	type appliedMigration struct {
		ID        string
		Name      string
		AppliedAt string
	}

	sorted := make([]appliedMigration, 0, len(applied))
	for id, data := range applied {
		sorted = append(sorted, appliedMigration{
			ID:        id,
			Name:      data["name"].(string),
			AppliedAt: data["applied_at"].(string),
		})
	}

	rolledBack := make([]string, 0)

	for i := 0; i < steps && i < len(sorted); i++ {
		record := sorted[i]

		// Find migration
		var migration *Migration
		for _, m := range m.migrations {
			if m.ID == record.ID {
				migration = &m
				break
			}
		}

		if migration != nil {
			// Run down migration
			if err := migration.Down(m.client); err != nil {
				return rolledBack, err
			}

			// Remove migration record
			if err := m.removeMigration(record.ID); err != nil {
				return rolledBack, err
			}

			rolledBack = append(rolledBack, record.Name)
		}
	}

	return rolledBack, nil
}

// Status returns migration status
func (m *MigrationManager) Status() (map[string]string, error) {
	applied, err := m.getAppliedMigrations()
	if err != nil {
		return nil, err
	}

	status := make(map[string]string)

	for _, migration := range m.migrations {
		if data, exists := applied[migration.ID]; exists {
			status[migration.ID] = fmt.Sprintf("Applied (%s)", data["applied_at"])
		} else {
			status[migration.ID] = "Pending"
		}
	}

	return status, nil
}

func (m *MigrationManager) getAppliedMigrations() (map[string]map[string]interface{}, error) {
	resp, err := m.client.client.R().
		Get("/api/keys/torm:migrations")

	if err != nil || !resp.IsSuccess() {
		return make(map[string]map[string]interface{}), nil
	}

	var response struct {
		Value string `json:"value"`
	}

	if err := json.Unmarshal(resp.Body(), &response); err != nil {
		return make(map[string]map[string]interface{}), nil
	}

	var migrations map[string]map[string]interface{}
	if err := json.Unmarshal([]byte(response.Value), &migrations); err != nil {
		return make(map[string]map[string]interface{}), nil
	}

	return migrations, nil
}

func (m *MigrationManager) saveMigration(migration map[string]interface{}) error {
	applied, _ := m.getAppliedMigrations()
	applied[migration["id"].(string)] = migration

	jsonData, err := json.Marshal(applied)
	if err != nil {
		return err
	}

	resp, err := m.client.client.R().
		SetBody(map[string]interface{}{"value": string(jsonData)}).
		Put("/api/keys/torm:migrations")

	if err != nil {
		return err
	}

	if !resp.IsSuccess() {
		return fmt.Errorf("failed to save migration: %s", resp.Status())
	}

	return nil
}

func (m *MigrationManager) removeMigration(migrationID string) error {
	applied, _ := m.getAppliedMigrations()
	delete(applied, migrationID)

	jsonData, err := json.Marshal(applied)
	if err != nil {
		return err
	}

	resp, err := m.client.client.R().
		SetBody(map[string]interface{}{"value": string(jsonData)}).
		Put("/api/keys/torm:migrations")

	if err != nil {
		return err
	}

	if !resp.IsSuccess() {
		return fmt.Errorf("failed to remove migration: %s", resp.Status())
	}

	return nil
}
