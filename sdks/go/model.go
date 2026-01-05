package torm

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// Model represents a database model
type Model struct {
	client     *Client
	name       string
	collection string
	schema     map[string]ValidationRule
	validate   bool
}

// Create creates a new document
func (m *Model) Create(data map[string]interface{}) (map[string]interface{}, error) {
	if m.validate && m.schema != nil {
		if err := m.validateData(data, false); err != nil {
			return nil, err
		}
	}

	reqBody := map[string]interface{}{"data": data}
	resp, err := m.client.request("POST", "/api/"+m.collection, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("create failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resultData, ok := result["data"].(map[string]interface{}); ok {
		return resultData, nil
	}

	return result, nil
}

// Find finds all documents
func (m *Model) Find() ([]map[string]interface{}, error) {
	resp, err := m.client.request("GET", "/api/"+m.collection, nil)
	if err != nil {
		return nil, fmt.Errorf("find failed: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if docs, ok := result["documents"].([]interface{}); ok {
		documents := make([]map[string]interface{}, len(docs))
		for i, doc := range docs {
			if docMap, ok := doc.(map[string]interface{}); ok {
				documents[i] = docMap
			}
		}
		return documents, nil
	}

	return []map[string]interface{}{}, nil
}

// FindByID finds a document by ID
func (m *Model) FindByID(id string) (map[string]interface{}, error) {
	resp, err := m.client.request("GET", "/api/"+m.collection+"/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("find by ID failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("find by ID failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}

// Update updates a document by ID
func (m *Model) Update(id string, data map[string]interface{}) (map[string]interface{}, error) {
	if m.validate && m.schema != nil {
		if err := m.validateData(data, true); err != nil {
			return nil, err
		}
	}

	reqBody := map[string]interface{}{"data": data}
	resp, err := m.client.request("PUT", "/api/"+m.collection+"/"+id, reqBody)
	if err != nil {
		return nil, fmt.Errorf("update failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("update failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resultData, ok := result["data"].(map[string]interface{}); ok {
		return resultData, nil
	}

	return result, nil
}

// Delete deletes a document by ID
func (m *Model) Delete(id string) (bool, error) {
	resp, err := m.client.request("DELETE", "/api/"+m.collection+"/"+id, nil)
	if err != nil {
		return false, fmt.Errorf("delete failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("delete failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode response: %w", err)
	}

	if success, ok := result["success"].(bool); ok {
		return success, nil
	}

	return false, nil
}

// Count counts all documents
func (m *Model) Count() (int, error) {
	resp, err := m.client.request("GET", "/api/"+m.collection+"/count", nil)
	if err != nil {
		return 0, fmt.Errorf("count failed: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode response: %w", err)
	}

	if count, ok := result["count"].(float64); ok {
		return int(count), nil
	}

	return 0, nil
}

// Query creates a new query builder
func (m *Model) Query() *QueryBuilder {
	return &QueryBuilder{
		client:     m.client,
		collection: m.collection,
		filters:    []QueryFilter{},
	}
}
