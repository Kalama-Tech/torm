/**
 * TORM Studio Server (Node.js)
 * Web-based visual database manager for ToonStoreDB
 */

import express, { Request, Response } from 'express';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs';

export interface StudioServerOptions {
  port?: number;
  host?: string;
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
}

export class StudioServer {
  private app: express.Application;
  private redis: Redis;
  private port: number;
  private host: string;

  constructor(options: StudioServerOptions = {}) {
    this.app = express();
    this.port = options.port || 4983; // Drizzle Studio uses 4983
    this.host = options.host || 'localhost';

    // Connect to ToonStoreDB from environment or options
    const redisUrl = process.env.TOONSTORE_URL || options.redisUrl;
    const redisHost = process.env.TOONSTORE_HOST || options.redisHost || 'localhost';
    const redisPort = Number(process.env.TOONSTORE_PORT) || options.redisPort || 6379;
    const redisPassword = process.env.TOONSTORE_PASSWORD || undefined;

    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
      });
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  private setupRoutes() {
    // Serve Studio UI
    this.app.get('/', (req, res) => {
      const htmlPath = path.join(__dirname, '..', 'studio', 'index.html');
      
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        // Replace the title to show "local.torm.studio"
        html = html.replace(
          '<title>TORM Studio - ToonStore Database Manager</title>',
          '<title>local.torm.studio - TORM Studio</title>'
        );
        res.send(html);
      } else {
        res.status(500).send('Studio UI not found');
      }
    });

    // API: Get all keys (collections)
    this.app.get('/api/keys', async (req, res) => {
      try {
        const pattern = req.query.pattern as string || '*';
        const keys = await this.redis.keys(pattern);
        
        // Group keys by collection
        const collections = new Map<string, string[]>();
        
        keys.forEach(key => {
          const parts = key.split(':');
          if (parts.length >= 2 && parts[0] === 'toonstore') {
            const collection = parts[1];
            if (!collections.has(collection)) {
              collections.set(collection, []);
            }
            collections.get(collection)!.push(key);
          }
        });

        res.json({
          total: keys.length,
          collections: Array.from(collections.entries()).map(([name, keys]) => ({
            name,
            count: keys.length,
            keys,
          })),
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Get value by key
    this.app.get('/api/key/:key', async (req, res) => {
      try {
        const key = decodeURIComponent(req.params.key);
        const value = await this.redis.get(key);
        
        if (value === null) {
          return res.status(404).json({ error: 'Key not found' });
        }

        // Try to parse as JSON
        let parsedValue;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          parsedValue = value;
        }

        res.json({
          key,
          value: parsedValue,
          type: typeof parsedValue,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Set value
    this.app.post('/api/key/:key', async (req, res) => {
      try {
        const key = decodeURIComponent(req.params.key);
        const { value } = req.body;
        
        const stringValue = typeof value === 'string' 
          ? value 
          : JSON.stringify(value);

        await this.redis.set(key, stringValue);
        
        res.json({ 
          success: true, 
          key,
          message: 'Key set successfully' 
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Delete key
    this.app.delete('/api/key/:key', async (req, res) => {
      try {
        const key = decodeURIComponent(req.params.key);
        const result = await this.redis.del(key);
        
        res.json({ 
          success: result > 0,
          deleted: result,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Database stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        const info = await this.redis.info();
        const dbsize = await this.redis.dbsize();
        
        // Parse info string
        const lines = info.split('\r\n');
        const stats: any = {};
        
        lines.forEach(line => {
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            stats[key.trim()] = value.trim();
          }
        });

        res.json({
          total_keys: dbsize,
          used_memory: stats.used_memory_human || 'N/A',
          connected_clients: stats.connected_clients || 'N/A',
          uptime_days: stats.uptime_in_days || 'N/A',
          redis_version: stats.redis_version || 'N/A',
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Get collection data
    this.app.get('/api/collection/:name', async (req, res) => {
      try {
        const collection = req.params.name;
        
        // Special handling for _migrations
        if (collection === '_migrations') {
          const migrationsData = await this.redis.get('toonstore:_migrations');
          if (migrationsData) {
            try {
              const migrations = JSON.parse(migrationsData);
              const documents = Array.isArray(migrations) 
                ? migrations.map((name: string) => ({ 
                    _id: name, 
                    name, 
                    appliedAt: 'N/A' 
                  }))
                : [];
              
              return res.json({
                collection,
                count: documents.length,
                documents,
              });
            } catch (e) {
              return res.json({
                collection,
                count: 0,
                documents: [],
              });
            }
          }
          
          return res.json({
            collection,
            count: 0,
            documents: [],
          });
        }
        
        // Regular collections
        const pattern = `toonstore:${collection}:*`;
        const keys = await this.redis.keys(pattern);
        
        const documents = [];
        for (const key of keys) {
          const value = await this.redis.get(key);
          if (value) {
            try {
              documents.push(JSON.parse(value));
            } catch {
              documents.push({ _raw: value });
            }
          }
        }

        res.json({
          collection,
          count: documents.length,
          documents,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        await this.redis.ping();
        res.json({ 
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        res.status(500).json({ 
          status: 'error',
          error: error.message 
        });
      }
    });

    // API: Get migrations status
    this.app.get('/api/migrations/status', async (req, res) => {
      try {
        const { MigrationRunner } = require('./migrations');
        const runner = new MigrationRunner({
          host: this.redis.options.host,
          port: this.redis.options.port,
        }, process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'migrations'));

        const applied = await runner.getAppliedMigrations();
        const pending = await runner.getPendingMigrations();
        
        await runner.close();

        res.json({
          applied: applied.map((name: string) => ({
            name,
            appliedAt: new Date().toISOString(), // TODO: Store actual timestamp
          })),
          pending: pending.map((m: any) => ({
            name: m.name,
            timestamp: m.timestamp,
          })),
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Run migrations up
    this.app.post('/api/migrations/up', async (req, res) => {
      try {
        const { MigrationRunner } = require('./migrations');
        const { count } = req.body || {};
        
        const runner = new MigrationRunner({
          host: this.redis.options.host,
          port: this.redis.options.port,
        }, process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'migrations'));

        await runner.up(count);
        await runner.close();

        res.json({ success: true, message: 'Migrations applied successfully' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Rollback migrations
    this.app.post('/api/migrations/down', async (req, res) => {
      try {
        const { MigrationRunner } = require('./migrations');
        const { count } = req.body || { count: 1 };
        
        const runner = new MigrationRunner({
          host: this.redis.options.host,
          port: this.redis.options.port,
        }, process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'migrations'));

        await runner.down(count);
        await runner.close();

        res.json({ success: true, message: 'Migration rolled back successfully' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Create migration
    this.app.post('/api/migrations/create', async (req, res) => {
      try {
        const { MigrationRunner } = require('./migrations');
        const { name } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Migration name is required' });
        }

        const runner = new MigrationRunner({
          host: this.redis.options.host,
          port: this.redis.options.port,
        }, process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'migrations'));

        await runner.create(name);
        await runner.close();

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const filename = `${timestamp}_${name}.js`;

        res.json({ success: true, filename, message: 'Migration created successfully' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Generate TypeScript types
    this.app.post('/api/generate/types', async (req, res) => {
      try {
        const keys = await this.redis.keys('toonstore:*');
        
        if (keys.length === 0) {
          return res.json({ 
            success: true, 
            models: [], 
            message: 'No data found in database' 
          });
        }

        // Group by model
        const modelMap: { [key: string]: any[] } = {};
        
        for (const key of keys) {
          const parts = key.split(':');
          if (parts.length >= 3 && parts[0] === 'toonstore') {
            const modelName = parts[1];
            if (modelName === '_migrations') continue;
            
            if (!modelMap[modelName]) {
              modelMap[modelName] = [];
            }
            
            const data = await this.redis.get(key);
            if (data) {
              try {
                modelMap[modelName].push(JSON.parse(data));
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        const modelNames = Object.keys(modelMap);

        // Generate types
        let output = `/**\n * Auto-generated TypeScript types from ToonStoreDB\n * Generated: ${new Date().toISOString()}\n * \n * ⚠️  DO NOT EDIT MANUALLY - This file is auto-generated\n * Run 'npx torm generate' to regenerate\n */\n\n`;

        for (const modelName of modelNames) {
          const documents = modelMap[modelName];
          const fieldTypes: { [key: string]: Set<string> } = {};
          
          for (const doc of documents) {
            for (const [field, value] of Object.entries(doc)) {
              if (!fieldTypes[field]) {
                fieldTypes[field] = new Set();
              }
              fieldTypes[field].add(this.inferType(value));
            }
          }

          const interfaceName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
          output += `export interface ${interfaceName} {\n`;
          
          const fields = Object.keys(fieldTypes).sort((a, b) => {
            if (a.startsWith('_') && !b.startsWith('_')) return -1;
            if (!a.startsWith('_') && b.startsWith('_')) return 1;
            return a.localeCompare(b);
          });

          for (const field of fields) {
            const types = Array.from(fieldTypes[field]);
            const typeStr = types.length > 1 ? types.join(' | ') : types[0];
            const isOptional = documents.some((doc: any) => !(field in doc));
            const optionalMarker = isOptional ? '?' : '';
            
            output += `  ${field}${optionalMarker}: ${typeStr};\n`;
          }
          
          output += `}\n\n`;
        }

        // Write to file
        const outputDir = path.join(process.cwd(), 'src', 'generated');
        const outputFile = path.join(outputDir, 'torm-types.ts');

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputFile, output);

        res.json({
          success: true,
          models: modelNames,
          outputFile,
          message: `Generated types for ${modelNames.length} model(s)`,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Preview generated types
    this.app.get('/api/generate/preview', async (req, res) => {
      try {
        const keys = await this.redis.keys('toonstore:*');
        
        if (keys.length === 0) {
          return res.send('// No data found in database');
        }

        // Group by model
        const modelMap: { [key: string]: any[] } = {};
        
        for (const key of keys) {
          const parts = key.split(':');
          if (parts.length >= 3 && parts[0] === 'toonstore') {
            const modelName = parts[1];
            if (modelName === '_migrations') continue;
            
            if (!modelMap[modelName]) {
              modelMap[modelName] = [];
            }
            
            const data = await this.redis.get(key);
            if (data) {
              try {
                modelMap[modelName].push(JSON.parse(data));
              } catch (e) {
                // Skip
              }
            }
          }
        }

        const modelNames = Object.keys(modelMap);

        // Generate types
        let output = `/**\n * Auto-generated TypeScript types from ToonStoreDB\n * Generated: ${new Date().toISOString()}\n */\n\n`;

        for (const modelName of modelNames) {
          const documents = modelMap[modelName];
          const fieldTypes: { [key: string]: Set<string> } = {};
          
          for (const doc of documents) {
            for (const [field, value] of Object.entries(doc)) {
              if (!fieldTypes[field]) {
                fieldTypes[field] = new Set();
              }
              fieldTypes[field].add(this.inferType(value));
            }
          }

          const interfaceName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
          output += `export interface ${interfaceName} {\n`;
          
          const fields = Object.keys(fieldTypes).sort();

          for (const field of fields) {
            const types = Array.from(fieldTypes[field]);
            const typeStr = types.length > 1 ? types.join(' | ') : types[0];
            const isOptional = documents.some((doc: any) => !(field in doc));
            
            output += `  ${field}${isOptional ? '?' : ''}: ${typeStr};\n`;
          }
          
          output += `}\n\n`;
        }

        res.contentType('text/typescript').send(output);
      } catch (error: any) {
        res.status(500).send(`// Error: ${error.message}`);
      }
    });
  }

  private inferType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    
    if (type === 'string') return 'string';
    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'any[]';
      
      const elementTypes = new Set(value.map((v: any) => this.inferType(v)));
      if (elementTypes.size === 1) {
        return `${Array.from(elementTypes)[0]}[]`;
      }
      return `(${Array.from(elementTypes).join(' | ')})[]`;
    }
    
    if (type === 'object') return 'any';
    
    return 'any';
  }

  async start(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Test connection first
      console.log('🔌 Testing database connection...');
      
      try {
        await this.redis.ping();
        console.log('✅ Connected to ToonStoreDB\n');
      } catch (error: any) {
        console.error('❌ Failed to connect to ToonStoreDB:');
        console.error('   ', error.message);
        console.error('\n💡 Check your torm.config.ts credentials');
        console.error('   or make sure ToonStoreDB is running\n');
        process.exit(1);
      }

      this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`\n🎨 TORM Studio running at:`);
        console.log(`   → http://localhost:${this.port}\n`);
        console.log(`💡 Press Ctrl+C to stop\n`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.redis.quit();
  }
}

// CLI usage
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 4983;
  const server = new StudioServer({ port });
  
  server.start().catch((err) => {
    console.error('Failed to start studio server:', err);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down TORM Studio...');
    await server.stop();
    process.exit(0);
  });
}
