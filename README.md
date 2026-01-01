# TORM - ToonStore Object-Relational Mapper

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Mongoose-style ORM for ToonStore** - Type-safe models with validation, queries, and relationships.

---

## 🎯 What is TORM?

TORM is an Object-Relational Mapper (ORM) for ToonStore, inspired by Mongoose (MongoDB). It provides:

- ✅ **Type-safe models** with Rust derive macros
- ✅ **Application-level schemas** (storage stays schemaless)
- ✅ **Query builder** for filtering and sorting
- ✅ **Validation** with built-in and custom validators
- ✅ **Relationships** (references between models)
- ✅ **Multi-language support** via REST API

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

- [TORM Design](../toonstoredb/docs/TORM_DESIGN.md)
- [Multi-Language Strategy](../toonstoredb/docs/TORM_MULTI_LANGUAGE.md)

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

## 🗺️ Roadmap

### Phase 1: Core ORM (Weeks 5-6)
- [x] Project structure
- [ ] Model trait
- [ ] CRUD operations
- [ ] Redis integration

### Phase 2: REST API Server (Weeks 5-6)
- [ ] HTTP server with Axum
- [ ] CRUD endpoints
- [ ] Query API

### Phase 3: Language SDKs (Weeks 7-10)
- [ ] Node.js SDK
- [ ] Python SDK
- [ ] Go SDK
- [ ] PHP SDK

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

**Built with ❤️ for ToonStore**
