# ToonStore TORM - Go SDK

A Mongoose-style ORM client for ToonStore database in Go.

## Installation

```bash
go get github.com/toonstore/torm-go
```

## Quick Start

```go
package main

import (
    "fmt"
    torm "github.com/toonstore/torm-go"
)

func main() {
    // Connect to TORM server
    client := torm.NewClient(&torm.ClientOptions{
        BaseURL: "http://localhost:3001",
    })
    
    // Define a model with validation
    User := client.Model("User", map[string]torm.ValidationRule{
        "name": {
            Type:      "string",
            Required:  true,
            MinLength: torm.IntPtr(3),
        },
        "email": {
            Type:  "string",
            Email: true,
        },
        "age": {
            Type: "int",
            Min:  torm.Float64Ptr(13),
            Max:  torm.Float64Ptr(120),
        },
    })
    
    // Create a user
    user, err := User.Create(map[string]interface{}{
        "id":    "user:1",
        "name":  "Alice",
        "email": "alice@example.com",
        "age":   30,
    })
    
    // Query users
    adults, err := User.Query().
        Filter("age", torm.Gte, 18).
        Sort("name", torm.Asc).
        Limit(10).
        Exec()
}
```

## Features

- ✅ **Type-Safe Models** with schema validation
- ✅ **Query Builder** with fluent API
- ✅ **12+ Validators** (email, URL, min/max, patterns, custom)
- ✅ **CRUD Operations** (create, read, update, delete)
- ✅ **Filtering & Sorting** with 9 query operators
- ✅ **Zero Dependencies** - uses standard library only

## API Reference

### Client

```go
// Create client with default options
client := torm.NewClient(nil)

// Create client with custom options
client := torm.NewClient(&torm.ClientOptions{
    BaseURL: "http://localhost:3001",
    Timeout: 10 * time.Second,
})

// Create a model
User := client.Model("User", schema)

// Check server health
health, err := client.Health()

// Get server info
info, err := client.Info()
```

### Model

```go
// Create document
doc, err := User.Create(map[string]interface{}{
    "name": "Alice",
    "email": "alice@example.com",
})

// Find all
users, err := User.Find()

// Find by ID
user, err := User.FindByID("user:1")

// Update
updated, err := User.Update("user:1", map[string]interface{}{
    "age": 31,
})

// Delete
success, err := User.Delete("user:1")

// Count
count, err := User.Count()

// Query
results, err := User.Query().Filter("age", torm.Gte, 18).Exec()
```

### Query Builder

```go
query := User.Query()

// Add filters
query.Filter("age", torm.Gte, 18)
query.Where("active", true)  // Shorthand for Eq

// Sort
query.Sort("name", torm.Asc)  // or torm.Desc

// Pagination
query.Limit(10)
query.Skip(20)

// Execute
results, err := query.Exec()
count, err := query.Count()

// Chain operations
results, err := User.Query().
    Filter("age", torm.Gte, 18).
    Sort("name", torm.Asc).
    Limit(10).
    Exec()
```

### Validation Schema

```go
schema := map[string]torm.ValidationRule{
    "name": {
        Type:      "string",     // string, int, float, bool, map, slice
        Required:  true,
        MinLength: torm.IntPtr(3),
        MaxLength: torm.IntPtr(100),
    },
    "email": {
        Type:  "string",
        Email: true,            // Email format validation
    },
    "website": {
        Type: "string",
        URL:  true,             // URL format validation
    },
    "age": {
        Type: "int",
        Min:  torm.Float64Ptr(13),
        Max:  torm.Float64Ptr(120),
    },
    "code": {
        Type:    "string",
        Pattern: `^[A-Z]{3}-\d{5}$`,  // Regex pattern
    },
    "custom": {
        Validate: func(v interface{}) bool {  // Custom validator
            num, ok := v.(float64)
            return ok && num > 0
        },
    },
}
```

### Query Operators

```go
torm.Eq       // Equal to
torm.Ne       // Not equal to
torm.Gt       // Greater than
torm.Gte      // Greater than or equal
torm.Lt       // Less than
torm.Lte      // Less than or equal
torm.Contains // String contains
torm.In       // Value in array
torm.NotIn    // Value not in array
```

## Examples

### User Management

```go
User := client.Model("User", map[string]torm.ValidationRule{
    "username": {
        Type:      "string",
        Required:  true,
        MinLength: torm.IntPtr(3),
    },
    "email": {
        Type:  "string",
        Email: true,
    },
    "role": {
        Type: "string",
    },
    "active": {
        Type: "bool",
    },
})

// Create admin
admin, err := User.Create(map[string]interface{}{
    "id":       "user:admin",
    "username": "admin",
    "email":    "admin@example.com",
    "role":     "admin",
    "active":   true,
})

// Find active users
activeUsers, err := User.Query().
    Filter("active", torm.Eq, true).
    Sort("username", torm.Asc).
    Exec()
```

### E-Commerce

```go
Product := client.Model("Product", map[string]torm.ValidationRule{
    "name": {
        Type:     "string",
        Required: true,
    },
    "price": {
        Type: "float",
        Min:  torm.Float64Ptr(0),
    },
    "stock": {
        Type: "int",
        Min:  torm.Float64Ptr(0),
    },
    "sku": {
        Type:    "string",
        Pattern: `^[A-Z]{3}-\d{5}$`,
    },
})

// Add product
laptop, err := Product.Create(map[string]interface{}{
    "id":    "product:1",
    "name":  "Laptop",
    "price": 999.99,
    "stock": 50,
    "sku":   "LAP-12345",
})

// Find in-stock products
available, err := Product.Query().
    Filter("stock", torm.Gt, 0).
    Sort("price", torm.Asc).
    Exec()
```

## Error Handling

```go
user, err := User.Create(map[string]interface{}{
    "name": "Al",  // Too short
})
if err != nil {
    fmt.Printf("Validation failed: %v\n", err)
}

health, err := client.Health()
if err != nil {
    fmt.Printf("Connection failed: %v\n", err)
}
```

## Requirements

- Go 1.21 or higher
- No external dependencies (uses standard library only)

## Running Examples

```bash
# Start TORM server first
cd ../../
cargo run --package torm-server --release

# In another terminal, run example
cd sdks/go
go run examples/basic_usage.go
```

## License

MIT

## Links

- **GitHub:** https://github.com/toonstore/torm
- **Documentation:** https://toonstore.dev/docs/torm
- **Issues:** https://github.com/toonstore/torm/issues

---

**Built with ❤️ for the ToonStore ecosystem**
