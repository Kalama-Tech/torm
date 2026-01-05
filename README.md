# TORM - ToonStore Object-Relational Mapper

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Mongoose-style ORM for ToonStore** - Type-safe, schemaless models with validation, queries, and relationships across Rust, Node.js, Python, Go, and PHP.

---

## 🎯 What is TORM?

TORM is an Object-Relational Mapper (ORM) for ToonStore, inspired by **Mongoose** (MongoDB's ORM). Just as MongoDB is schemaless but Mongoose provides application-level schemas, **ToonStore is schemaless but TORM provides type-safe models**.

### Key Features

- ✅ **Schemaless Storage** - ToonStore stores data in efficient [TOON format](https://github.com/toon-format/toon) without rigid schemas
- ✅ **Application-Level Schemas** - Type-safe models with validation in your code
- ✅ **Type Safety** - Rust derive macros & type checking across all languages
- ✅ **Validation** - Built-in validators (email, URL, length, range, pattern)
- ✅ **Query Builder** - Fluent API for filtering, sorting, and pagination
- ✅ **Relationships** - Reference other models like traditional ORMs
- ✅ **Migrations** - Track and manage schema changes over time
- ✅ **TORM Studio** - Visual database management (like Drizzle Studio)
- ✅ **Multi-Language** - Rust, Node.js, Python, Go, PHP support via REST API

---

## 📦 What is the TOON Format?

**TOON (Token-Oriented Object Notation)** is a compact, human-readable data format designed for the age of AI and LLMs. ToonStore uses TOON format for efficient data storage.

### Why TOON in the AI Era?

- **🤖 LLM-Optimized**: 74% accuracy vs JSON's 70% in LLM comprehension benchmarks
- **💰 Cost-Efficient**: ~40-60% fewer tokens = lower API costs for AI applications
- **📊 Schema-Aware**: Explicit `[N]` lengths and `{fields}` help LLMs parse reliably
- **🔄 JSON-Compatible**: Lossless round-trips with same objects/arrays/primitives
- **👁️ Human-Readable**: YAML-like readability with CSV-style compactness

### TOON vs JSON Example

**JSON** (22,250 tokens):
```json
{
  "users": [
    {"id": "1", "name": "Alice", "email": "alice@example.com", "age": 30},
    {"id": "2", "name": "Bob", "email": "bob@example.com", "age": 25}
  ]
}
```

**TOON** (9,120 tokens - 59% reduction):
```
users[2]{id,name,email,age}:
  1,Alice,alice@example.com,30
  2,Bob,bob@example.com,25
```

**Learn More**: [TOON Format Repository](https://github.com/toon-format/toon)

---

## 🤔 Why TORM?

### The Problem: Schemaless Needs Structure

While schemaless databases offer flexibility, applications need:
- **Type safety** to prevent bugs
- **Validation** to ensure data quality  
- **Relationships** to model real-world data
- **Consistent APIs** across languages

### The Solution: Application-Level Schemas

Like **MongoDB + Mongoose**, TORM combines the best of both:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Storage** | ToonStore (schemaless TOON format) | Fast, flexible, token-efficient storage |
| **Application** | TORM (schemas) | Type safety, validation, relationships |

Benefits:
- 🚀 **Performance** - ToonStore's speed (5.28M ops/sec)
- 🛡️ **Safety** - Type checking and validation at application level
- 🔄 **Flexibility** - Add fields without database migrations
- 💰 **Efficiency** - TOON format saves ~40% tokens (perfect for AI/LLM apps)
- 💪 **Power** - Rich query APIs and relationship support

---

## 📦 Components

### 1. TORM Library (`crates/torm`)
Rust library for defining models and interacting with ToonStore

### 2. TORM Server (`crates/torm-server`)
REST API server for multi-language support (Node.js, Python, Go, PHP)

### 3. TORM Derive (`crates/torm-derive`)
Proc macros for deriving Model trait

---

## 🚀 Quick Start (Rust)

```rust
use torm::{Model, TormDb};
use serde::{Deserialize, Serialize};

#[derive(Model, Serialize, Deserialize, Debug)]
struct User {
    #[id]
    id: String,
    name: String,
    email: String,
    age: Option<u32>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to ToonStore
    let db = TormDb::connect("redis://localhost:6379").await?;
    
    // Create user
    let user = User {
        id: "user:1".into(),
        name: "John Doe".into(),
        email: "john@example.com".into(),
        age: Some(30),
    };
    
    user.save(&db).await?;
    
    // Find user
    let found = User::find_by_id(&db, "user:1").await?;
    println!("Found: {:?}", found);
    
    Ok(())
}
```

---

## 🌍 Multi-Language Support

TORM Server provides REST API for any language:

### Node.js
```javascript
const { TormClient, Model } = require('@toonstore/torm');
const torm = new TormClient('http://localhost:3001');

const User = Model.define('User', { /* schema */ });
await user.save();
```

### Python
```python
from toonstore import TormClient, Model
torm = TormClient('http://localhost:3001')

class User(Model):
    name: str
    email: str

await user.save()
```

### Go
```go
import "github.com/toonstore/torm-go"

type User struct { /* fields */ }
client.Model("users").Create(&user)
```

---

## 📚 Documentation

### 🚀 Quick Start
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - URLs, commands, and common operations
- **[Getting Started Guide](docs/GETTING_STARTED.md)** - Complete beginner's tutorial with examples
- **[FAQ - All Your Questions Answered](docs/FAQ.md)** - Data format, persistence, TOON format, Studio access, etc.

### 📖 Core Guides
- **[Models & Schemas](docs/MODELS.md)** - Define type-safe models (Coming Soon)
- **[Validation](docs/VALIDATION.md)** - Built-in and custom validators (Coming Soon)
- **[Queries](docs/QUERIES.md)** - Filtering, sorting, pagination (Coming Soon)
- **[Relationships](docs/RELATIONSHIPS.md)** - Model relationships (Coming Soon)
- **[Migrations](docs/MIGRATIONS.md)** - Track schema changes and transform data

### 🎨 Tools
- **[TORM Studio](docs/STUDIO.md)** - Visual database management (like Drizzle Studio)
- **[CLI Reference](docs/CLI.md)** - Command-line tools (Coming Soon)

### 🌍 Multi-Language
- **[Rust API](docs/API_RUST.md)** - Rust library documentation (Coming Soon)
- **[REST API](docs/API_REST.md)** - HTTP API for all languages (Coming Soon)
- **[Node.js SDK](sdks/nodejs/README.md)** - JavaScript/TypeScript
- **[Python SDK](sdks/python/README.md)** - Python
- **[Go SDK](sdks/go/README.md)** - Go
- **[PHP SDK](sdks/php/README.md)** - PHP

### 📦 Publishing & Development
- **[Publishing Guide](docs/PUBLISHING_GUIDE.md)** - Publish SDKs to package managers
- **[Implementation Status](docs/IMPLEMENTATION_COMPLETE.md)** - Complete feature overview

---

## 🛠️ Development

```bash
# Build all crates
cargo build

# Run tests
cargo test

# Start TORM server
cargo run --bin torm-server

# Build release
cargo build --release
```

---

## 📂 Project Structure

```
torm/
├── Cargo.toml              # Workspace config
├── crates/
│   ├── torm/               # Core ORM library
│   ├── torm-server/        # REST API server
│   └── torm-derive/        # Proc macros
├── sdks/                   # Language SDKs
│   ├── nodejs/
│   ├── python/
│   ├── go/
│   └── php/
└── examples/               # Example projects
    ├── basic-crud/
    ├── relationships/
    └── validation/
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

**Built with ❤️ for ToonStore**
