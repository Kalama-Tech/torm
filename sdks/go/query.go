package torm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
)

// QueryOperator represents query comparison operators
type QueryOperator string

const (
	Eq       QueryOperator = "eq"
	Ne       QueryOperator = "ne"
	Gt       QueryOperator = "gt"
	Gte      QueryOperator = "gte"
	Lt       QueryOperator = "lt"
	Lte      QueryOperator = "lte"
	Contains QueryOperator = "contains"
	In       QueryOperator = "in"
	NotIn    QueryOperator = "not_in"
)

// SortOrder represents sort order
type SortOrder string

const (
	Asc  SortOrder = "asc"
	Desc SortOrder = "desc"
)

// QueryFilter represents a query filter
type QueryFilter struct {
	Field    string        `json:"field"`
	Operator QueryOperator `json:"operator"`
	Value    interface{}   `json:"value"`
}

// QuerySort represents query sorting
type QuerySort struct {
	Field string    `json:"field"`
	Order SortOrder `json:"order"`
}

// QueryBuilder builds complex queries
type QueryBuilder struct {
	client     *Client
	collection string
	filters    []QueryFilter
	sortField  *QuerySort
	limitVal   *int
	skipVal    *int
}

// Filter adds a filter condition
func (qb *QueryBuilder) Filter(field string, operator QueryOperator, value interface{}) *QueryBuilder {
	qb.filters = append(qb.filters, QueryFilter{
		Field:    field,
		Operator: operator,
		Value:    value,
	})
	return qb
}

// Where adds an equality filter (shorthand for Filter with Eq)
func (qb *QueryBuilder) Where(field string, value interface{}) *QueryBuilder {
	return qb.Filter(field, Eq, value)
}

// Sort sets sort field and order
func (qb *QueryBuilder) Sort(field string, order SortOrder) *QueryBuilder {
	qb.sortField = &QuerySort{
		Field: field,
		Order: order,
	}
	return qb
}

// Limit sets maximum number of results
func (qb *QueryBuilder) Limit(n int) *QueryBuilder {
	qb.limitVal = &n
	return qb
}

// Skip sets number of results to skip
func (qb *QueryBuilder) Skip(n int) *QueryBuilder {
	qb.skipVal = &n
	return qb
}

// Exec executes the query
func (qb *QueryBuilder) Exec() ([]map[string]interface{}, error) {
	queryData := make(map[string]interface{})
	
	if len(qb.filters) > 0 {
		queryData["filters"] = qb.filters
	}
	if qb.sortField != nil {
		queryData["sort"] = qb.sortField
	}
	if qb.limitVal != nil {
		queryData["limit"] = *qb.limitVal
	}
	if qb.skipVal != nil {
		queryData["skip"] = *qb.skipVal
	}
	
	resp, err := qb.client.request("POST", "/api/"+qb.collection+"/query", queryData)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("query failed with status %d", resp.StatusCode)
	}
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	docs, ok := result["documents"].([]interface{})
	if !ok {
		return []map[string]interface{}{}, nil
	}
	
	documents := make([]map[string]interface{}, 0, len(docs))
	for _, doc := range docs {
		if docMap, ok := doc.(map[string]interface{}); ok {
			if qb.matchesFilters(docMap) {
				documents = append(documents, docMap)
			}
		}
	}
	
	// Apply client-side sorting
	if qb.sortField != nil {
		qb.sortDocuments(documents)
	}
	
	return documents, nil
}

// Count counts matching documents
func (qb *QueryBuilder) Count() (int, error) {
	docs, err := qb.Exec()
	if err != nil {
		return 0, err
	}
	return len(docs), nil
}

// matchesFilters checks if document matches all filters
func (qb *QueryBuilder) matchesFilters(doc map[string]interface{}) bool {
	for _, filter := range qb.filters {
		docValue := doc[filter.Field]
		if !qb.matchesFilter(docValue, filter.Operator, filter.Value) {
			return false
		}
	}
	return true
}

// matchesFilter checks if value matches filter
func (qb *QueryBuilder) matchesFilter(docValue interface{}, operator QueryOperator, filterValue interface{}) bool {
	switch operator {
	case Eq:
		return fmt.Sprintf("%v", docValue) == fmt.Sprintf("%v", filterValue)
	case Ne:
		return fmt.Sprintf("%v", docValue) != fmt.Sprintf("%v", filterValue)
	case Gt:
		return qb.compareValues(docValue, filterValue) > 0
	case Gte:
		return qb.compareValues(docValue, filterValue) >= 0
	case Lt:
		return qb.compareValues(docValue, filterValue) < 0
	case Lte:
		return qb.compareValues(docValue, filterValue) <= 0
	case Contains:
		docStr := fmt.Sprintf("%v", docValue)
		filterStr := fmt.Sprintf("%v", filterValue)
		return contains(docStr, filterStr)
	case In:
		if arr, ok := filterValue.([]interface{}); ok {
			for _, item := range arr {
				if fmt.Sprintf("%v", docValue) == fmt.Sprintf("%v", item) {
					return true
				}
			}
		}
		return false
	case NotIn:
		if arr, ok := filterValue.([]interface{}); ok {
			for _, item := range arr {
				if fmt.Sprintf("%v", docValue) == fmt.Sprintf("%v", item) {
					return false
				}
			}
		}
		return true
	}
	return false
}

// compareValues compares two values
func (qb *QueryBuilder) compareValues(a, b interface{}) int {
	aFloat, aOk := toFloat64(a)
	bFloat, bOk := toFloat64(b)
	
	if aOk && bOk {
		if aFloat > bFloat {
			return 1
		} else if aFloat < bFloat {
			return -1
		}
		return 0
	}
	
	aStr := fmt.Sprintf("%v", a)
	bStr := fmt.Sprintf("%v", b)
	
	if aStr > bStr {
		return 1
	} else if aStr < bStr {
		return -1
	}
	return 0
}

// sortDocuments sorts documents by the sort field
func (qb *QueryBuilder) sortDocuments(docs []map[string]interface{}) {
	if qb.sortField == nil {
		return
	}
	
	field := qb.sortField.Field
	ascending := qb.sortField.Order == Asc
	
	sort.Slice(docs, func(i, j int) bool {
		valI := docs[i][field]
		valJ := docs[j][field]
		
		cmp := qb.compareValues(valI, valJ)
		
		if ascending {
			return cmp < 0
		}
		return cmp > 0
	})
}

// Helper functions

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || 
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func toFloat64(val interface{}) (float64, bool) {
	switch v := val.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case int32:
		return float64(v), true
	default:
		return 0, false
	}
}
