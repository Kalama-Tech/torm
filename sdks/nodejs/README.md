# @toonstore/torm

> ToonStoreDB ORM Client for Node.js & TypeScript

A Mongoose-style ORM client for ToonStoreDB, providing type-safe models, validation, and query building.

> **What is ToonStoreDB?** ToonStoreDB is a blazingly fast embedded database with a built-in caching layer. This SDK lets you work with ToonStoreDB using a familiar Mongoose-like API.

## 🎯 Quick Summary

**What is this?** A TypeScript/JavaScript ORM library (like Mongoose for MongoDB or Drizzle for PostgreSQL) that lets you easily work with ToonStoreDB.

**What do I need?**
- ✅ ToonStoreDB server running (the database)
- ✅ This npm package (`@toonstore/torm`)
- ✅ Node.js/TypeScript project

**What is TORM Studio?** An optional visual management tool (like phpMyAdmin or MongoDB Compass) for managing your ToonStoreDB data - NOT required for the SDK to work.

## ✨ Features

- ✅ **Type-Safe** - Full TypeScript support with generics
- ✅ **Direct Database Connection** - Connects directly to ToonStoreDB
- ✅ **Mongoose-Like API** - Familiar API for easy adoption
- ✅ **Schema Validation** - Built-in validators (email, URL, min/max, patterns, custom)
- ✅ **Query Builder** - Fluent API for filtering, sorting, and pagination
- ✅ **Async/Await** - Modern promise-based API
- ✅ **Auto-Generated IDs** - Automatic document ID generation with timestamps
- ✅ **Zero Configuration** - Works out of the box with sensible defaults

## 📦 Installation

```bash
npm install @toonstore/torm
# or
yarn add @toonstore/torm
# or
pnpm add @toonstore/torm
```

## 🚀 Quick Start

### Prerequisites

**ToonStoreDB must be running:**

```bash
# Start ToonStoreDB
./toonstoredb
# Default: localhost:6379

# Or using Docker
docker run -d -p 6379:6379 samso9th/toonstore:latest

# Or install from releases
# Download from: https://github.com/kalama-tech/toonstoredb/releases
```

> **Note:** ToonStoreDB is a high-performance database with Redis-compatible protocol. The SDK connects directly to your ToonStoreDB instance.

### Installation

```bash
npm install @toonstore/torm
```

### Step 1: Connect to ToonStoreDB

Create a new file (e.g., `app.ts`):

```typescript
import { TormClient } from '@toonstore/torm';

// Connect to ToonStoreDB
const torm = new TormClient({
  host: 'localhost',
  port: 6379,
  // Or use connection URL:
  // url: 'toonstoredb://localhost:6379'
});

// Check connection
const health = await torm.health();
console.log('Database health:', health);
```

### Step 2: Define Your Models

Define TypeScript interfaces and create models with validation:

```typescript
// Define your data structure
interface User {
  name: string;
  email: string;
  age: number;
  website?: string;
}

// Create model with schema validation
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
  website: {
    type: 'string',
    url: true,
  },
});
```

### Step 3: Perform CRUD Operations

```typescript
// Create a user (ID auto-generated)
const user = await User.create({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  website: 'https://alice.dev',
});
console.log('Created user:', user._id);

// Find all users
const allUsers = await User.find();

// Find user by ID
const foundUser = await User.findById(user._id);

// Find one user by criteria
const alice = await User.findOne({ email: 'alice@example.com' });

// Update user
const updated = await User.update(user._id, { age: 31 });

// Delete user
await User.delete(user._id);

// Count users
const count = await User.count();
```

### Step 4: Query with Filters

```typescript
// Find users 18 and older
const adults = await User.query()
  .where('age', 'gte', 18)
  .sort('name', 'asc')
  .exec();

// Pagination
const page1 = await User.query()
  .sort('_createdAt', 'desc')
  .limit(10)
  .skip(0)
  .exec();

// Complex queries
const result = await User.query()
  .where('age', 'gte', 18)
  .where('age', 'lte', 65)
  .sort('name', 'asc')
  .limit(20)
  .exec();
```

### Step 5: Launch TORM Studio (Optional)

Visual database manager for browsing and editing data:

```bash
# First time - auto-generates config
npx torm studio

# Edit torm.config.ts with your database credentials
# Then run again:
npx torm studio
```

Opens at http://localhost:4983 with a visual interface to browse collections, edit records, and view stats.

## 🛠️ CLI Commands

TORM includes a powerful CLI for database management and development workflows:

### TORM Studio

Launch the visual database manager (bundled with the SDK):

```bash
# Start TORM Studio
npx torm studio
```

**First Run:** If no `torm.config.ts` exists, it will be auto-generated. Edit it with your database credentials, then run `npx torm studio` again.

**Access:** http://localhost:4983

**Configuration:**

You can use either TypeScript or JavaScript config files:

**Option 1: TypeScript Config (Recommended)**

Create `torm.config.ts` in your project root:
```typescript
export default {
  dbCredentials: {
    host: 'localhost',  // or cloud host
    port: 6379,
    // For cloud/auth:
    // password: 'your-password',
    // url: 'redis://user:pass@host:port',
  },
  studio: {
    port: 4983,  // default
  },
};
```

For TypeScript config files, install `tsx` (recommended) or `ts-node`:
```bash
npm install -D tsx
# or
npm install -D ts-node
```

**Option 2: JavaScript Config**

Create `torm.config.js` in your project root:
```javascript
module.exports = {
  dbCredentials: {
    host: 'localhost',
    port: 6379,
  },
  studio: {
    port: 4983,
  },
};
```

No additional dependencies needed for `.js` config files.

**Features:**
- 📊 Visual database browser - browse collections and documents
- ✏️ Create, read, update, delete records with UI
- 🔍 Search and filter data
- 📈 Real-time database statistics
- 🎨 Modern dark-themed interface
- ✅ No separate installation - fully bundled with npm package!
- 🌐 Works with local or cloud-hosted ToonStoreDB

**Custom Port:**
```bash
npx torm studio --port 8080
```

### Migrations

Create and run data-shape migrations for your schemaless database:

```bash
# Create a new migration
npx torm migrate:create add_age_field

# Run pending migrations
npx torm migrate:up

# Run specific number of migrations
npx torm migrate:up 1

# Rollback last migration
npx torm migrate:down

# Rollback multiple migrations
npx torm migrate:down 2

# Check migration status
npx torm migrate:status
```

**How Migrations Work with ToonStoreDB:**

ToonStoreDB is schemaless at the storage layer, but your application code assumes a particular data shape. Migrations help you evolve that shape over time.

**Example Workflow:**

```typescript
// Step 1: Create a migration file
// $ npx torm migrate:create add_age_to_users
// Creates: migrations/20260105_add_age_to_users.ts

// migrations/20260105_add_age_to_users.ts
export default {
  async up(client) {
    // Add 'age' field to all existing users with a default value
    const pattern = 'toonstore:User:*';
    const keys = await client.keys(pattern);
    
    for (const key of keys) {
      const data = JSON.parse(await client.get(key));
      if (!data.age) {
        data.age = 18; // Default value
        await client.set(key, JSON.stringify(data));
      }
    }
    
    console.log(`Updated ${keys.length} users with age field`);
  },
  
  async down(client) {
    // Remove 'age' field from all users
    const pattern = 'toonstore:User:*';
    const keys = await client.keys(pattern);
    
    for (const key of keys) {
      const data = JSON.parse(await client.get(key));
      delete data.age;
      await client.set(key, JSON.stringify(data));
    }
    
    console.log(`Removed age field from ${keys.length} users`);
  },
};

// Step 2: Run migration
// $ npx torm migrate:up
// Applies: 20260105_add_age_to_users
```

**Common Migration Patterns:**

```typescript
// 1. Add field with default value
export default {
  async up(client) {
    const keys = await client.keys('toonstore:User:*');
    for (const key of keys) {
      const user = JSON.parse(await client.get(key));
      user.verified = user.verified ?? false;
      await client.set(key, JSON.stringify(user));
    }
  },
  async down(client) {
    const keys = await client.keys('toonstore:User:*');
    for (const key of keys) {
      const user = JSON.parse(await client.get(key));
      delete user.verified;
      await client.set(key, JSON.stringify(user));
    }
  },
};

// 2. Rename field
export default {
  async up(client) {
    const keys = await client.keys('toonstore:Post:*');
    for (const key of keys) {
      const post = JSON.parse(await client.get(key));
      if (post.author_id) {
        post.authorId = post.author_id;
        delete post.author_id;
        await client.set(key, JSON.stringify(post));
      }
    }
  },
  async down(client) {
    const keys = await client.keys('toonstore:Post:*');
    for (const key of keys) {
      const post = JSON.parse(await client.get(key));
      if (post.authorId) {
        post.author_id = post.authorId;
        delete post.authorId;
        await client.set(key, JSON.stringify(post));
      }
    }
  },
};

// 3. Data transformation
export default {
  async up(client) {
    const keys = await client.keys('toonstore:User:*');
    for (const key of keys) {
      const user = JSON.parse(await client.get(key));
      // Split full name into first and last
      if (user.name && !user.firstName) {
        const [firstName, ...lastName] = user.name.split(' ');
        user.firstName = firstName;
        user.lastName = lastName.join(' ');
        delete user.name;
        await client.set(key, JSON.stringify(user));
      }
    }
  },
  async down(client) {
    const keys = await client.keys('toonstore:User:*');
    for (const key of keys) {
      const user = JSON.parse(await client.get(key));
      if (user.firstName) {
        user.name = `${user.firstName} ${user.lastName || ''}`.trim();
        delete user.firstName;
        delete user.lastName;
        await client.set(key, JSON.stringify(user));
      }
    }
  },
};
```

**Migration Tracking:**

TORM tracks which migrations have run using a special key:
```
toonstore:_migrations -> ["20260105_add_age_to_users", "20260106_rename_author_field"]
```

**Best Practices:**

1. **Never modify old migrations** - create new ones to fix issues
2. **Always provide `down()` for rollback** - test it works
3. **Use transactions when available** - ensure atomic changes
4. **Test on copy of production data** - before running in prod
5. **Version control migrations** - commit with code changes

### Type Generation (Coming Soon)

```bash
# Generate TypeScript types from your schema
npx torm generate

# Watch mode for development
npx torm generate --watch
```

**How Type Generation Will Work:**

TORM will introspect your database and generate TypeScript interfaces:

```bash
# Scan your database and generate types
$ npx torm generate

# Output: src/generated/torm-types.ts
```

**Generated Types:**
```typescript
// src/generated/torm-types.ts (auto-generated)
export interface User {
  _id: string;
  name: string;
  email: string;
  age: number;
  website?: string;
  _createdAt: string;
  _updatedAt: string;
}

export interface Post {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  _createdAt: string;
  _updatedAt: string;
}

// Use generated types
import { User, Post } from './generated/torm-types';

const User = torm.model<User>('User');
const Post = torm.model<Post>('Post');
```

## 📖 API Documentation

### TormClient

#### Constructor

```typescript
const torm = new TormClient(options?: TormClientOptions);
```

**Options:**
- `host` (string) - ToonStoreDB host (default: `localhost`)
- `port` (number) - ToonStoreDB port (default: `6379`)
- `url` (string) - ToonStoreDB connection URL (e.g., `toonstoredb://localhost:6379`)
- All standard connection options are supported

#### Methods

- `model<T>(name, schema?, options?)` - Create a model
- `health()` - Check database connection health
- `disconnect()` - Close database connection
- `isConnected()` - Check if connected to database
- `getClient()` - Get underlying database client instance

### Model

All documents automatically include:
- `_id` - Auto-generated unique ID
- `_createdAt` - ISO timestamp of creation
- `_updatedAt` - ISO timestamp of last update

#### CRUD Operations

```typescript
// Create (ID auto-generated)
const doc = await Model.create(data);
// Returns: { ...data, _id, _createdAt, _updatedAt }

// Read
const all = await Model.find();
const one = await Model.findById(id);
const match = await Model.findOne({ email: 'user@example.com' });

// Update
const updated = await Model.update(id, data);

// Delete
const deleted = await Model.delete(id);
await Model.deleteMany(); // Delete all
await Model.deleteMany({ status: 'inactive' }); // Delete matching

// Count
const count = await Model.count();
```

#### Query Builder

```typescript
const results = await Model.query()
  .where(field, operator, value)   // Add filter
  .equals(field, value)            // Shorthand for .where(field, 'eq', value)
  .sort(field, order)              // Sort results ('asc' | 'desc')
  .limit(n)                        // Limit results
  .skip(n)                         // Skip results (pagination)
  .exec();                         // Execute query

// Count with filters
const count = await Model.query()
  .where('status', 'eq', 'active')
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

// Custom validation (sync or async)
username: {
  type: 'string',
  validate: (value) => /^[a-z0-9_]+$/.test(value),
}

// Async custom validation
email: {
  type: 'string',
  validate: async (value) => {
    // Check if email is already taken
    const existing = await User.findOne({ email: value });
    return !existing;
  },
}
```

## 📝 Examples

### Example 1: User Management System

```typescript
import { TormClient } from '@toonstore/torm';

const torm = new TormClient();

interface User {
  username: string;
  email: string;
  age: number;
  role: 'admin' | 'user';
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
  role: {
    type: 'string',
    required: true,
  },
});

// Create users
const alice = await User.create({
  username: 'alice',
  email: 'alice@example.com',
  age: 30,
  role: 'admin',
});

// Find by role
const admins = await User.query()
  .where('role', 'eq', 'admin')
  .sort('username', 'asc')
  .exec();

// Find adults sorted by age
const adults = await User.query()
  .where('age', 'gte', 18)
  .sort('age', 'desc')
  .exec();
```

### Example 2: Blog Posts with Tags

```typescript
interface Post {
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  tags: string[];
  views: number;
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
  authorId: {
    type: 'string',
    required: true,
  },
  published: {
    type: 'boolean',
  },
  tags: {
    type: 'array',
  },
  views: {
    type: 'number',
    min: 0,
  },
});

// Create post
const post = await Post.create({
  title: 'Getting Started with TORM',
  content: 'TORM is an amazing ORM for ToonStoreDB with type-safe models and validation...',
  authorId: alice._id,
  published: true,
  tags: ['orm', 'database', 'toonstore', 'redis'],
  views: 0,
});

// Find published posts
const publishedPosts = await Post.query()
  .where('published', 'eq', true)
  .sort('_createdAt', 'desc')
  .limit(10)
  .exec();

// Find posts by author
const alicePosts = await Post.query()
  .where('authorId', 'eq', alice._id)
  .exec();

// Update view count
await Post.update(post._id, { views: post.views + 1 });
```

### Example 3: E-Commerce Product Catalog

```typescript
interface Product {
  name: string;
  price: number;
  stock: number;
  sku: string;
  category: string;
  description?: string;
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

// Create products
const laptop = await Product.create({
  name: 'Gaming Laptop',
  price: 1299.99,
  stock: 15,
  sku: 'LAP-12345',
  category: 'electronics',
  description: 'High-performance gaming laptop with RTX 4070',
});

// Find products in stock
const inStock = await Product.query()
  .where('stock', 'gt', 0)
  .sort('price', 'asc')
  .exec();

// Find by category with pagination
const electronics = await Product.query()
  .where('category', 'eq', 'electronics')
  .sort('name', 'asc')
  .skip(0)
  .limit(20)
  .exec();

// Find expensive products
const premium = await Product.query()
  .where('price', 'gte', 1000)
  .sort('price', 'desc')
  .exec();

// Low stock alert
const lowStock = await Product.query()
  .where('stock', 'lt', 10)
  .exec();
```

## 🔄 Migration from v0.1.x

Version 0.2.0 introduces breaking changes:

### What Changed
- **No more HTTP server required** - SDK now connects directly to ToonStoreDB
- **Auto-generated IDs** - No need to provide `id` field, use `_id` instead
- **New connection options** - Use `host`, `port`, or `url` for ToonStoreDB connection
- **TORM Studio bundled** - Visual database manager included (run `npx torm studio`)

### Migration Steps

**Old (v0.1.x):**
```typescript
// Required TORM server via HTTP
const torm = new TormClient({
  baseURL: 'http://localhost:3001',
});

const user = await User.create({
  id: 'user:1',  // Manual ID
  name: 'Alice',
});
```

**New (v0.2.x):**
```typescript
// Direct ToonStoreDB connection
const torm = new TormClient({
  host: 'localhost',
  port: 6379,
});

const user = await User.create({
  name: 'Alice',  // No id needed
});
console.log(user._id); // Auto-generated: "1736076000000-abc123xyz"

// Launch Studio
// $ npx torm studio
// Opens http://localhost:4983
```

**Steps:**
1. Update connection config (remove `baseURL`, add `host`/`port`)
2. Remove manual `id` fields from `create()` calls
3. Use `_id` to access document IDs
4. (Optional) Create `torm.config.ts` for Studio

## 🧪 Running Examples

```bash
# Make sure ToonStoreDB is running
./toonstoredb

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run basic example
npm run example
```

## 🏗️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test

# Start Studio
npm run studio
```

## 🎯 Complete Example

Here's a complete example building a blog application:

```typescript
import { TormClient } from '@toonstore/torm';

// 1. Connect to database
const torm = new TormClient({
  host: 'localhost',
  port: 6379,
});

// 2. Define models
interface User {
  username: string;
  email: string;
  bio?: string;
}

interface Post {
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  tags: string[];
}

const User = torm.model<User>('User', {
  username: {
    type: 'string',
    required: true,
    minLength: 3,
    pattern: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    type: 'string',
    required: true,
    email: true,
  },
  bio: {
    type: 'string',
    maxLength: 500,
  },
});

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
  authorId: {
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

// 3. Use the models
async function main() {
  // Create a user
  const user = await User.create({
    username: 'alice',
    email: 'alice@example.com',
    bio: 'Love coding and coffee ☕',
  });

  // Create posts
  await Post.create({
    title: 'Getting Started with ToonStoreDB',
    content: 'ToonStoreDB is a blazingly fast database...',
    authorId: user._id,
    published: true,
    tags: ['database', 'toonstoredb', 'tutorial'],
  });

  await Post.create({
    title: 'Building a Blog with TORM',
    content: 'TORM makes it easy to build applications...',
    authorId: user._id,
    published: false,
    tags: ['torm', 'tutorial'],
  });

  // Query published posts
  const publishedPosts = await Post.query()
    .where('published', 'eq', true)
    .where('authorId', 'eq', user._id)
    .sort('_createdAt', 'desc')
    .exec();

  console.log('Published posts:', publishedPosts.length);

  // Get user's post count
  const postCount = await Post.query()
    .where('authorId', 'eq', user._id)
    .count();

  console.log(`${user.username} has ${postCount} posts`);

  // Clean up
  await torm.disconnect();
}

main().catch(console.error);
```

## 🌟 Why TORM?

- **Standalone SDK** - No TORM server needed, just ToonStoreDB
- **Type Safety** - Full TypeScript support with generics
- **Familiar API** - If you know Mongoose, you know TORM
- **High Performance** - Leverages ToonStoreDB's blazing fast speed (5.28M ops/sec)
- **Validation Built-in** - Comprehensive validation without extra libraries
- **Modern Async/Await** - Clean, readable promise-based code

## 🏢 Architecture

```
Your Node.js App → @toonstore/torm SDK → ToonStoreDB
```

**What you need to run:**
- ✅ ToonStoreDB server (the database)
- ✅ Your Node.js app with this SDK

**What you DON'T need:**
- ❌ TORM Server (that's only for TORM Studio UI - a separate optional visual management tool)
- ❌ Any HTTP server or API layer
- ❌ Redis installation (ToonStoreDB is the database, it just uses Redis-compatible protocol internally)

## 🗺️ Roadmap

**SDK Features:**
- [ ] Relationships (references between models)
- [ ] Hooks (pre/post save, update, delete)
- [ ] Indexes and search optimization
- [ ] Transactions support
- [ ] Aggregation pipelines
- [ ] Virtual fields
- [ ] Plugins system

**CLI Tools:**
- [x] TORM Studio (bundled Node.js server) ✅
- [x] Schema migrations (data-shape migrations for schemaless DB) ✅
  - [x] `torm migrate:create` - Create migration file
  - [x] `torm migrate:up` - Run pending migrations
  - [x] `torm migrate:down` - Rollback last migration
  - [x] `torm migrate:status` - Check migration status
- [ ] Type generation from existing data
- [ ] Database seeding
- [ ] Data export/import tools

**Studio Enhancements:**
- [ ] Custom domain (local.torm.studio via DNS) - no hosts file needed
- [ ] Advanced query builder UI
- [ ] Export/import data
- [ ] Real-time collaboration
- [ ] Schema visualization

**Migration System (Planned):**

Unlike SQL databases, ToonStoreDB is schemaless—but you still need **data-shape migrations** for application-level schema evolution:

```bash
# Create migration for data transformation
torm migrate:create add_age_field

# Run pending migrations
torm migrate:up

# Rollback last migration
torm migrate:down

# Check what's been applied
torm migrate:status
```

**Example Migration:**
```typescript
// migrations/20260105_add_age_field.ts
export default {
  async up(client) {
    // Add 'age' to all users with default value
    const keys = await client.keys('toonstore:User:*');
    for (const key of keys) {
      const user = JSON.parse(await client.get(key));
      user.age = user.age ?? 18; // Default age
      await client.set(key, JSON.stringify(user));
    }
  },
  async down(client) {
    // Remove 'age' from all users
    const keys = await client.keys('toonstore:User:*');
    for (const key of keys) {
      const user = JSON.parse(await client.get(key));
      delete user.age;
      await client.set(key, JSON.stringify(user));
    }
  },
};
```

**Common Use Cases:**
- Add/remove fields with defaults
- Rename fields (`author_id` → `authorId`)
- Transform data (split name into first/last)
- Back-fill missing values
- Data cleanup and normalization

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🔗 Links

- [ToonStoreDB](https://github.com/toonstore/toonstoredb) - The blazingly fast database
- [TORM](https://github.com/toonstore/torm) - Multi-language ORM with Studio
- [TOON Format](https://github.com/toon-format/toon) - The data format specification
- [NPM Package](https://www.npmjs.com/package/@toonstore/torm)
- [TORM Studio Guide](https://github.com/toonstore/torm/blob/main/docs/STUDIO.md)

## 💬 Support

For questions and support, please open an issue on GitHub.
