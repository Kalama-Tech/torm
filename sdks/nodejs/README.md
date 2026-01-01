# @toonstore/torm

> ToonStore ORM Client for Node.js & TypeScript

A Mongoose-style ORM client for ToonStore, providing type-safe models, validation, and query building.

## ✨ Features

- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Validation** - Built-in validators (email, URL, min/max, patterns)
- ✅ **Query Builder** - Fluent API for filtering and sorting
- ✅ **Schema Definition** - Define your data models
- ✅ **Async/Await** - Promise-based API
- ✅ **HTTP-Based** - Communicates with TORM Server

## 📦 Installation

```bash
npm install @toonstore/torm
# or
yarn add @toonstore/torm
```

## 🚀 Quick Start

### Prerequisites

Make sure TORM server is running:
```bash
cargo run --package torm-server --release
# Server runs on http://localhost:3001
```

### Basic Usage

```typescript
import { TormClient } from '@toonstore/torm';

// 1. Create client
const torm = new TormClient({
  baseURL: 'http://localhost:3001',
  timeout: 5000,
});

// 2. Define model with schema
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

const User = torm.model<User>('User', {
  name: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 50,
  },
  email: {
    type: 'string',
    required: true,
    email: true,
  },
  age: {
    type: 'number',
    required: true,
    min: 13,
    max: 120,
  },
});

// 3. Create document
const user = await User.create({
  id: 'user:1',
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
});

// 4. Find documents
const allUsers = await User.find();
const specificUser = await User.findById('user:1');

// 5. Query with filters
const adults = await User.query()
  .filter('age', 'gte', 18)
  .sort('name', 'asc')
  .limit(10)
  .exec();

// 6. Update document
await User.update('user:1', { age: 31 });

// 7. Delete document
await User.delete('user:1');

// 8. Count documents
const count = await User.count();
```

## 📖 API Documentation

### TormClient

#### Constructor

```typescript
const torm = new TormClient(options?: TormClientOptions);
```

**Options:**
- `baseURL` (string) - TORM server URL (default: `http://localhost:3001`)
- `timeout` (number) - Request timeout in ms (default: `5000`)

#### Methods

- `model<T>(name, schema?, options?)` - Create a model
- `health()` - Check server health
- `info()` - Get server info

### Model

#### CRUD Operations

```typescript
// Create
const doc = await Model.create(data);

// Read
const all = await Model.find();
const one = await Model.findById(id);

// Update
const updated = await Model.update(id, data);

// Delete
const deleted = await Model.delete(id);

// Count
const count = await Model.count();
```

#### Query Builder

```typescript
const results = await Model.query()
  .filter(field, operator, value)  // Add filter
  .where(field, value)             // Shorthand for .filter(field, 'eq', value)
  .sort(field, order)              // Sort results
  .limit(n)                        // Limit results
  .skip(n)                         // Skip results
  .exec();                         // Execute query

// Count with filters
const count = await Model.query()
  .filter('status', 'eq', 'active')
  .count();
```

**Query Operators:**
- `eq` - Equal to
- `ne` - Not equal to
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `contains` - String contains
- `in` - Value in array
- `not_in` - Value not in array

### Validation

#### Schema Rules

```typescript
const schema = {
  fieldName: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
    required: boolean,
    
    // String validations
    minLength: number,
    maxLength: number,
    pattern: RegExp,
    email: boolean,
    url: boolean,
    
    // Number validations
    min: number,
    max: number,
    
    // Custom validation
    validate: (value) => boolean,
  },
};
```

#### Built-in Validators

```typescript
// Email validation
email: { type: 'string', email: true }

// URL validation
website: { type: 'string', url: true }

// String length
name: { type: 'string', minLength: 3, maxLength: 50 }

// Number range
age: { type: 'number', min: 0, max: 120 }

// Pattern matching
phone: { type: 'string', pattern: /^\d{10}$/ }

// Custom validation
username: {
  type: 'string',
  validate: (value) => /^[a-z0-9_]+$/.test(value),
}
```

## 📝 Examples

### Example 1: User Management

```typescript
import { TormClient } from '@toonstore/torm';

const torm = new TormClient();

interface User {
  id: string;
  username: string;
  email: string;
  age: number;
}

const User = torm.model<User>('User', {
  username: {
    type: 'string',
    required: true,
    minLength: 3,
    pattern: /^[a-z0-9_]+$/,
  },
  email: {
    type: 'string',
    required: true,
    email: true,
  },
  age: {
    type: 'number',
    min: 18,
  },
});

// Create users
await User.create({
  id: 'user:1',
  username: 'alice',
  email: 'alice@example.com',
  age: 30,
});

// Find adults
const adults = await User.query()
  .filter('age', 'gte', 18)
  .sort('username', 'asc')
  .exec();
```

### Example 2: Blog Posts

```typescript
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  tags: string[];
}

const Post = torm.model<Post>('Post', {
  title: {
    type: 'string',
    required: true,
    minLength: 5,
    maxLength: 200,
  },
  content: {
    type: 'string',
    required: true,
    minLength: 10,
  },
  author_id: {
    type: 'string',
    required: true,
  },
  published: {
    type: 'boolean',
  },
  tags: {
    type: 'array',
  },
});

// Create post
await Post.create({
  id: 'post:1',
  title: 'Getting Started with TORM',
  content: 'TORM is an amazing ORM for ToonStore...',
  author_id: 'user:1',
  published: true,
  tags: ['orm', 'database', 'toonstore'],
});

// Find published posts
const published = await Post.query()
  .filter('published', 'eq', true)
  .sort('created_at', 'desc')
  .limit(10)
  .exec();

// Find posts by author
const authorPosts = await Post.query()
  .filter('author_id', 'eq', 'user:1')
  .exec();
```

### Example 3: E-Commerce Products

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
  category: string;
}

const Product = torm.model<Product>('Product', {
  name: {
    type: 'string',
    required: true,
  },
  price: {
    type: 'number',
    required: true,
    min: 0,
  },
  stock: {
    type: 'number',
    required: true,
    min: 0,
  },
  sku: {
    type: 'string',
    required: true,
    pattern: /^[A-Z]{3}-\d{5}$/,
  },
});

// Create product
await Product.create({
  id: 'product:1',
  name: 'Laptop',
  price: 999.99,
  stock: 50,
  sku: 'LAP-12345',
  category: 'electronics',
});

// Find products in stock
const inStock = await Product.query()
  .filter('stock', 'gt', 0)
  .sort('price', 'asc')
  .exec();

// Find expensive products
const expensive = await Product.query()
  .filter('price', 'gte', 1000)
  .exec();
```

## 🧪 Running Examples

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run basic example
npm run example
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode (auto-rebuild)
npm run dev
```

## 📄 License

MIT

## 🙏 Credits

- Inspired by [Mongoose](https://mongoosejs.com/)
- Built for [ToonStore](https://github.com/toon-format/toon)
