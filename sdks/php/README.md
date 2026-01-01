# ToonStore TORM - PHP SDK

A Mongoose-style ORM client for ToonStore database in PHP.

## Installation

```bash
composer require toonstore/torm
```

## Quick Start

```php
<?php

require 'vendor/autoload.php';

use Toonstore\Torm\TormClient;

// Connect to TORM server
$torm = new TormClient('http://localhost:3001');

// Define a model with validation
$User = $torm->model('User', [
    'name' => ['type' => 'string', 'required' => true, 'min_length' => 3],
    'email' => ['type' => 'string', 'required' => true, 'email' => true],
    'age' => ['type' => 'integer', 'min' => 13, 'max' => 120]
]);

// Create a user
$user = $User->create([
    'id' => 'user:1',
    'name' => 'Alice',
    'email' => 'alice@example.com',
    'age' => 30
]);

// Query users
$adults = $User->query()
    ->filter('age', 'gte', 18)
    ->sort('name', 'asc')
    ->limit(10)
    ->exec();
```

## Features

- ✅ **Type-Safe Models** with schema validation
- ✅ **Query Builder** with fluent API
- ✅ **12+ Validators** (email, URL, min/max, patterns, custom)
- ✅ **CRUD Operations** (create, read, update, delete)
- ✅ **Filtering & Sorting** with 9 query operators
- ✅ **Modern PHP 8.0+** with typed properties and match expressions

## API Reference

### TormClient

```php
// Create client
$torm = new TormClient('http://localhost:3001', $timeout = 5);

// Create a model
$User = $torm->model('User', $schema, $collection = null, $validate = true);

// Check server health
$health = $torm->health();

// Get server info
$info = $torm->info();
```

### Model

```php
// Create document
$doc = $User->create([
    'name' => 'Alice',
    'email' => 'alice@example.com'
]);

// Find all
$users = $User->find();

// Find by ID
$user = $User->findById('user:1');

// Update
$updated = $User->update('user:1', ['age' => 31]);

// Delete
$success = $User->delete('user:1');

// Count
$count = $User->count();

// Query
$results = $User->query()->filter('age', 'gte', 18)->exec();
```

### Query Builder

```php
$query = $User->query();

// Add filters
$query->filter('age', 'gte', 18);
$query->where('active', true);  // Shorthand for eq

// Sort
$query->sort('name', 'asc');  // or 'desc'

// Pagination
$query->limit(10);
$query->skip(20);

// Execute
$results = $query->exec();
$count = $query->count();

// Chain operations
$results = $User->query()
    ->filter('age', 'gte', 18)
    ->sort('name', 'asc')
    ->limit(10)
    ->exec();
```

### Validation Schema

```php
$schema = [
    'name' => [
        'type' => 'string',      // string, integer, float, boolean, array, object
        'required' => true,
        'min_length' => 3,
        'max_length' => 100
    ],
    'email' => [
        'type' => 'string',
        'email' => true         // Email format validation
    ],
    'website' => [
        'type' => 'string',
        'url' => true           // URL format validation
    ],
    'age' => [
        'type' => 'integer',
        'min' => 13,
        'max' => 120
    ],
    'code' => [
        'type' => 'string',
        'pattern' => '/^[A-Z]{3}-\d{5}$/'  // Regex pattern
    ],
    'custom' => [
        'validate' => fn($v) => $v > 0  // Custom validator
    ]
];
```

### Query Operators

- `eq` - Equal to
- `ne` - Not equal to
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `contains` - String contains
- `in` - Value in array
- `not_in` - Value not in array

## Examples

### User Management

```php
$User = $torm->model('User', [
    'username' => ['type' => 'string', 'required' => true, 'min_length' => 3],
    'email' => ['type' => 'string', 'email' => true],
    'role' => ['type' => 'string'],
    'active' => ['type' => 'boolean']
]);

// Create admin
$admin = $User->create([
    'id' => 'user:admin',
    'username' => 'admin',
    'email' => 'admin@example.com',
    'role' => 'admin',
    'active' => true
]);

// Find active users
$activeUsers = $User->query()
    ->filter('active', 'eq', true)
    ->sort('username', 'asc')
    ->exec();
```

### E-Commerce

```php
$Product = $torm->model('Product', [
    'name' => ['type' => 'string', 'required' => true],
    'price' => ['type' => 'float', 'min' => 0],
    'stock' => ['type' => 'integer', 'min' => 0],
    'sku' => ['type' => 'string', 'pattern' => '/^[A-Z]{3}-\d{5}$/']
]);

// Add product
$laptop = $Product->create([
    'id' => 'product:1',
    'name' => 'Laptop',
    'price' => 999.99,
    'stock' => 50,
    'sku' => 'LAP-12345'
]);

// Find in-stock products
$available = $Product->query()
    ->filter('stock', 'gt', 0)
    ->sort('price', 'asc')
    ->exec();
```

## Error Handling

```php
use Exception;

try {
    $user = $User->create(['name' => 'Al']);  // Too short
} catch (Exception $e) {
    echo "Validation failed: {$e->getMessage()}\n";
}

try {
    $health = $torm->health();
} catch (Exception $e) {
    echo "Connection failed: {$e->getMessage()}\n";
}
```

## Requirements

- PHP 8.0 or higher
- ext-json

## Running Examples

```bash
# Install dependencies
composer install

# Start TORM server first
cd ../../
cargo run --package torm-server --release

# In another terminal, run example
cd sdks/php
php examples/basic_usage.php
```

## License

MIT

## Links

- **GitHub:** https://github.com/toonstore/torm
- **Packagist:** https://packagist.org/packages/toonstore/torm
- **Documentation:** https://toonstore.dev/docs/torm
- **Issues:** https://github.com/toonstore/torm/issues

---

**Built with ❤️ for the ToonStore ecosystem**
