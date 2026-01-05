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
