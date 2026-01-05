package torm

import (
	"fmt"
	"regexp"
	"strings"
)

// ValidationRule defines validation rules for a field
type ValidationRule struct {
	Type      string                 `json:"type,omitempty"` // str, int, float, bool, map, slice
	Required  bool                   `json:"required,omitempty"`
	Min       *float64               `json:"min,omitempty"`        // For numbers
	Max       *float64               `json:"max,omitempty"`        // For numbers
	MinLength *int                   `json:"min_length,omitempty"` // For strings
	MaxLength *int                   `json:"max_length,omitempty"` // For strings
	Pattern   string                 `json:"pattern,omitempty"`    // Regex pattern
	Email     bool                   `json:"email,omitempty"`      // Email validation
	URL       bool                   `json:"url,omitempty"`        // URL validation
	Validate  func(interface{}) bool `json:"-"`                    // Custom validator
}

// validateData validates data against schema
func (m *Model) validateData(data map[string]interface{}, partial bool) error {
	for field, rules := range m.schema {
		value, exists := data[field]

		// Required check
		if rules.Required && !partial && !exists {
			return fmt.Errorf("validation error: field '%s' is required", field)
		}

		// Skip if value doesn't exist and not required
		if !exists {
			continue
		}

		// Type check
		if rules.Type != "" {
			if err := checkType(value, rules.Type); err != nil {
				return fmt.Errorf("validation error: field '%s' %v", field, err)
			}
		}

		// String validations
		if str, ok := value.(string); ok {
			if rules.MinLength != nil && len(str) < *rules.MinLength {
				return fmt.Errorf("validation error: field '%s' must be at least %d characters",
					field, *rules.MinLength)
			}
			if rules.MaxLength != nil && len(str) > *rules.MaxLength {
				return fmt.Errorf("validation error: field '%s' must be at most %d characters",
					field, *rules.MaxLength)
			}
			if rules.Email && !isEmail(str) {
				return fmt.Errorf("validation error: field '%s' must be a valid email", field)
			}
			if rules.URL && !isURL(str) {
				return fmt.Errorf("validation error: field '%s' must be a valid URL", field)
			}
			if rules.Pattern != "" {
				matched, err := regexp.MatchString(rules.Pattern, str)
				if err != nil || !matched {
					return fmt.Errorf("validation error: field '%s' does not match pattern", field)
				}
			}
		}

		// Number validations
		if num, ok := toFloat64(value); ok {
			if rules.Min != nil && num < *rules.Min {
				return fmt.Errorf("validation error: field '%s' must be at least %v", field, *rules.Min)
			}
			if rules.Max != nil && num > *rules.Max {
				return fmt.Errorf("validation error: field '%s' must be at most %v", field, *rules.Max)
			}
		}

		// Custom validation
		if rules.Validate != nil && !rules.Validate(value) {
			return fmt.Errorf("validation error: field '%s' failed custom validation", field)
		}
	}

	return nil
}

// checkType checks if value matches expected type
func checkType(value interface{}, expectedType string) error {
	switch expectedType {
	case "str", "string":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("must be of type string")
		}
	case "int":
		switch value.(type) {
		case int, int32, int64:
			return nil
		default:
			return fmt.Errorf("must be of type int")
		}
	case "float":
		switch value.(type) {
		case float32, float64:
			return nil
		default:
			return fmt.Errorf("must be of type float")
		}
	case "bool":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("must be of type bool")
		}
	case "map":
		if _, ok := value.(map[string]interface{}); !ok {
			return fmt.Errorf("must be of type map")
		}
	case "slice", "array":
		if _, ok := value.([]interface{}); !ok {
			return fmt.Errorf("must be of type array")
		}
	}
	return nil
}

// isEmail checks if string is a valid email
func isEmail(email string) bool {
	pattern := `^[^\s@]+@[^\s@]+\.[^\s@]+$`
	matched, _ := regexp.MatchString(pattern, email)
	return matched
}

// isURL checks if string is a valid URL
func isURL(url string) bool {
	return strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")
}

// Helper functions for creating validation rules

// Float64Ptr returns a pointer to a float64
func Float64Ptr(f float64) *float64 {
	return &f
}

// IntPtr returns a pointer to an int
func IntPtr(i int) *int {
	return &i
}
