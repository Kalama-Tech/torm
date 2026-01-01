# ToonStore TORM - Python SDK

A Mongoose-style ORM client for ToonStore database in Python.

## Installation

```bash
pip install toonstore-torm
```

## Quick Start

```python
from toonstore_torm import TormClient

# Connect to TORM server
torm = TormClient('http://localhost:3001')

# Define a model with validation
User = torm.model('User', {
    'name': {'type': 'str', 'required': True, 'min_length': 3},
    'email': {'type': 'str', 'required': True, 'email': True},
    'age': {'type': 'int', 'min': 13, 'max': 120}
})

# Create a user
user = User.create({
    'id': 'user:1',
    'name': 'Alice',
    'email': 'alice@example.com',
    'age': 30
})

# Query users
adults = User.query() \
    .filter('age', 'gte', 18) \
    .sort('name', 'asc') \
    .limit(10) \
    .exec()
```

## Features

- ✅ **Type-Safe Models** with schema validation
- ✅ **Query Builder** with fluent API
- ✅ **12+ Validators** (email, URL, min/max, patterns, custom)
- ✅ **CRUD Operations** (create, read, update, delete)
- ✅ **Filtering & Sorting** with 9 query operators
- ✅ **Context Manager** support for automatic cleanup

## API Reference

### TormClient

```python
torm = TormClient(base_url='http://localhost:3001', timeout=5)

# Create a model
User = torm.model(name='User', schema={...}, collection='users', validate=True)

# Check server health
health = torm.health()

# Get server info
info = torm.info()

# Use as context manager
with TormClient() as torm:
    User = torm.model('User', {...})
    # ... operations ...
```

### Model

```python
# Create document
doc = User.create({'name': 'Alice', 'email': 'alice@example.com'})

# Find all
users = User.find()

# Find by ID
user = User.find_by_id('user:1')

# Update
updated = User.update('user:1', {'age': 31})

# Delete
success = User.delete('user:1')

# Count
count = User.count()

# Query
results = User.query().filter('age', 'gte', 18).exec()
```

### Query Builder

```python
query = User.query()

# Add filters
query.filter('age', 'gte', 18)
query.where('active', True)  # Shorthand for eq

# Sort
query.sort('name', 'asc')  # or 'desc'

# Pagination
query.limit(10)
query.skip(20)

# Execute
results = query.exec()
count = query.count()
```

### Validation Schema

```python
schema = {
    'name': {
        'type': 'str',           # str, int, float, bool, list, dict
        'required': True,
        'min_length': 3,
        'max_length': 100
    },
    'email': {
        'type': 'str',
        'email': True           # Email format validation
    },
    'website': {
        'type': 'str',
        'url': True             # URL format validation
    },
    'age': {
        'type': 'int',
        'min': 13,
        'max': 120
    },
    'code': {
        'type': 'str',
        'pattern': r'^[A-Z]{3}-\d{5}$'  # Regex pattern
    },
    'custom': {
        'validate': lambda x: x > 0  # Custom validator
    }
}
```

### Query Operators

- `eq` - Equal to
- `ne` - Not equal to
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `contains` - String contains
- `in` - Value in list
- `not_in` - Value not in list

## Examples

### User Management

```python
from toonstore_torm import TormClient

torm = TormClient()
User = torm.model('User', {
    'username': {'type': 'str', 'required': True, 'min_length': 3},
    'email': {'type': 'str', 'email': True},
    'role': {'type': 'str'},
    'active': {'type': 'bool'}
})

# Create admin
admin = User.create({
    'id': 'user:admin',
    'username': 'admin',
    'email': 'admin@example.com',
    'role': 'admin',
    'active': True
})

# Find active users
active_users = User.query() \
    .filter('active', 'eq', True) \
    .sort('username', 'asc') \
    .exec()
```

### E-Commerce

```python
Product = torm.model('Product', {
    'name': {'type': 'str', 'required': True},
    'price': {'type': 'float', 'min': 0},
    'stock': {'type': 'int', 'min': 0},
    'sku': {'type': 'str', 'pattern': r'^[A-Z]{3}-\d{5}$'}
})

# Add product
laptop = Product.create({
    'id': 'product:1',
    'name': 'Laptop',
    'price': 999.99,
    'stock': 50,
    'sku': 'LAP-12345'
})

# Find in-stock products
available = Product.query() \
    .filter('stock', 'gt', 0) \
    .sort('price', 'asc') \
    .exec()
```

## Error Handling

```python
from toonstore_torm import ValidationError, TormError, ConnectionError

try:
    user = User.create({'name': 'Al'})  # Too short
except ValidationError as e:
    print(f"Validation failed: {e}")

try:
    torm.health()
except ConnectionError as e:
    print(f"Connection failed: {e}")

try:
    User.find()
except TormError as e:
    print(f"Operation failed: {e}")
```

## Requirements

- Python 3.8+
- requests >= 2.31.0

## License

MIT

## Links

- **GitHub:** https://github.com/toonstore/torm
- **Documentation:** https://toonstore.dev/docs/torm
- **Issues:** https://github.com/toonstore/torm/issues

---

**Built with ❤️ for the ToonStore ecosystem**
