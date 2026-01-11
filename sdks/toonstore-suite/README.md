# create-toonstore-app

> Interactive installer for ToonStore suite (ToonStoreDB + TORM)

One command to set up the entire ToonStore stack - database, ORM, and development environment.

## 🚀 Quick Start

```bash
npx @toonstore/create-toonstore-app
```

That's it! The installer will guide you through:

1. **Database Deployment** - Local (Docker, Binary, etc.) or Cloud (AWS, GCP, etc.)
2. **Language Selection** - Auto-detects your project (Node.js, Python, Go, PHP)
3. **SDK Installation** - Installs and configures TORM for your language
4. **Example Setup** - Creates working example code to get you started

## 📦 What Gets Installed

### ToonStoreDB
- High-performance database with built-in caching
- Redis-compatible protocol
- Multiple deployment options

### TORM SDK
- Mongoose-style ORM for your language
- Type-safe models and validation
- Query builder with filters, sorting, pagination
- TORM Studio for visual data management
- Migration system for schema evolution

## 🎯 Installation Options

### Local Deployment

- **Docker** (Recommended) - One command, fully isolated
- **Binary** - Pre-built executable, no Docker needed
- **Docker Compose** - Multi-container setup with volumes
- **Build from Source** - Latest features, requires Rust
- **Embedded Library** - For Rust projects only

### Cloud Deployment

Guided setup for:
- AWS (EC2, ECS, Fargate)
- Google Cloud Platform
- Microsoft Azure
- Coolify
- Dockploy
- Railway
- DigitalOcean
- Render
- Fly.io

## 🔧 Features

- ✅ Auto-detects your project language
- ✅ Validates all installations
- ✅ Creates config files automatically
- ✅ Generates working example code
- ✅ Adds npm scripts (for Node.js projects)
- ✅ Handles all dependencies
- ✅ Beautiful CLI with progress indicators
- ✅ Error handling and helpful messages

## 📚 Documentation

- [ToonStoreDB](https://github.com/kalama-tech/toonstoredb)
- [TORM](https://github.com/kalama-tech/torm)
- [Full Documentation](https://docs.toonstore.dev)

## 🤝 Contributing

Contributions welcome! See the [main repository](https://github.com/kalama-tech/torm) for guidelines.

## 📄 License

MIT

---

**Built with ❤️ for the ToonStore ecosystem**
