#!/usr/bin/env node

/**
 * TORM CLI
 * Command-line interface for ToonStoreDB ORM
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { MigrationRunner } from './migrations';

const command = process.argv[2];
const subcommand = process.argv[3];
const args = process.argv.slice(3);

function printHelp() {
  console.log(`
TORM CLI - ToonStoreDB ORM Tools

Usage:
  torm <command> [options]

Commands:
  studio                         Launch TORM Studio (visual database manager)
  migrate:create <name>         Create a new migration file
  migrate:up [count]            Run pending migrations (optional: number to run)
  migrate:down [count]          Rollback migrations (default: 1)
  migrate:status                Show migration status
  help                          Show this help message

Examples:
  torm studio                   # Start TORM Studio at http://localhost:4983
  torm studio --port 8080       # Start on custom port
  
  torm migrate:create add_age   # Create migration file
  torm migrate:up               # Run all pending migrations
  torm migrate:up 1             # Run 1 migration
  torm migrate:down             # Rollback last migration
  torm migrate:down 2           # Rollback last 2 migrations
  torm migrate:status           # Show applied/pending migrations

Config:
  Create torm.config.ts in your project root with DB credentials

For more info, visit: https://github.com/toonstore/torm
`);
}

interface TormConfig {
  dbCredentials?: {
    host?: string;
    port?: number;
    password?: string;
    url?: string;
  };
  studio?: {
    port?: number;
    host?: string;
  };
  migrations?: {
    directory?: string;
  };
}

function findConfig(): TormConfig | null {
  const configPaths = [
    path.join(process.cwd(), 'torm.config.ts'),
    path.join(process.cwd(), 'torm.config.js'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      console.log(`📝 Found config: ${configPath}\n`);
      try {
        if (configPath.endsWith('.ts')) {
          // Check if TypeScript loader is available
          const hasLoader = checkTypeScriptLoader();
          
          if (!hasLoader) {
            console.error('⚠️  TypeScript config found but tsx/ts-node not installed');
            console.error('   Install with: npm install -D tsx');
            console.error('   Or use torm.config.js instead\n');
            continue;
          }
          
          // Try to register TypeScript loader
          try {
            require('tsx/cjs');
          } catch {
            try {
              require('ts-node/register');
            } catch {
              // Loader exists but can't register - try direct require anyway
            }
          }
          
          const config = require(configPath);
          return config.default || config;
        } else if (configPath.endsWith('.js')) {
          const config = require(configPath);
          return config.default || config;
        }
      } catch (err: any) {
        console.error(`⚠️  Error loading config: ${err.message}\n`);
      }
    }
  }

  return null;
}

async function studio() {
  console.log('🚀 Starting TORM Studio...\n');
  
  // Load config
  const config = findConfig();
  
  // If no config found, create one based on project type
  if (!config) {
    console.log('⚠️  No torm.config found in current directory\n');
    console.log('Creating a default config for you...\n');
    
    // Detect project type
    const isTypeScriptProject = detectTypeScriptProject();
    
    if (isTypeScriptProject) {
      console.log('📦 TypeScript project detected');
      // Check for TypeScript loaders
      const hasTsxOrTsNode = checkTypeScriptLoader();
      
      if (!hasTsxOrTsNode) {
        console.log('⚠️  TypeScript runtime not found');
        console.log('   Installing tsx for TypeScript support...\n');
        
        // Try to install tsx
        try {
          const { execSync } = require('child_process');
          execSync('npm install -D tsx', { stdio: 'inherit' });
          console.log('\n✅ Installed tsx\n');
          createTypeScriptConfig();
        } catch (e) {
          console.log('\n⚠️  Could not auto-install tsx');
          console.log('   Creating .js config instead\n');
          createJavaScriptConfig();
        }
      } else {
        createTypeScriptConfig();
      }
    } else {
      console.log('📦 JavaScript project detected');
      createJavaScriptConfig();
    }
    
    console.log('✅ Created config file');
    console.log('   Edit this file with your database credentials\n');
    console.log('   Then run `torm studio` again\n');
    process.exit(0);
  }

  // Get port from args or config or default
  let port = 4983; // Drizzle uses 4983
  if (args.includes('--port')) {
    port = parseInt(args[args.indexOf('--port') + 1]);
  } else if (config.studio?.port) {
    port = config.studio.port;
  }

  // Check if studio-server.js exists
  const serverPath = path.join(__dirname, 'studio-server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.error('❌ Studio server not found!');
    console.error('   Expected at:', serverPath);
    console.error('\n💡 Run `npm run build` first\n');
    process.exit(1);
  }

  console.log('📍 Starting TORM Studio server...\n');

  // Pass config to server via environment
  const env = {
    ...process.env,
    PORT: port.toString(),
    TOONSTORE_HOST: config.dbCredentials?.host || 'localhost',
    TOONSTORE_PORT: (config.dbCredentials?.port || 6379).toString(),
    TOONSTORE_URL: config.dbCredentials?.url || '',
    TOONSTORE_PASSWORD: config.dbCredentials?.password || '',
  };

  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env,
  });

  server.on('error', (err) => {
    console.error('\n❌ Error starting TORM Studio:');
    console.error('   ', err.message);
    process.exit(1);
  });

  server.on('close', (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  TORM Studio exited with code ${code}`);
    }
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down TORM Studio...');
    server.kill('SIGINT');
    process.exit(0);
  });
}

async function migrate() {
  const action = command.split(':')[1]; // migrate:create, migrate:up, etc.
  
  const config = findConfig();
  
  if (!config) {
    console.error('❌ No torm.config.ts found');
    console.error('   Create one first by running: torm studio\n');
    process.exit(1);
  }

  const dbOptions = {
    host: config.dbCredentials?.host || process.env.TOONSTORE_HOST || 'localhost',
    port: config.dbCredentials?.port || Number(process.env.TOONSTORE_PORT) || 6379,
    url: config.dbCredentials?.url || process.env.TOONSTORE_URL,
  };

  const migrationsDir = config.migrations?.directory || path.join(process.cwd(), 'migrations');
  const runner = new MigrationRunner(dbOptions, migrationsDir);

  try {
    switch (action) {
      case 'create': {
        const name = subcommand;
        if (!name) {
          console.error('❌ Migration name required');
          console.error('   Usage: torm migrate:create <name>\n');
          process.exit(1);
        }
        await runner.create(name);
        break;
      }

      case 'up': {
        const count = subcommand ? parseInt(subcommand) : undefined;
        await runner.up(count);
        break;
      }

      case 'down': {
        const count = subcommand ? parseInt(subcommand) : 1;
        await runner.down(count);
        break;
      }

      case 'status': {
        await runner.status();
        break;
      }

      default:
        console.error(`❌ Unknown migration command: ${action}`);
        console.error('   Use: create, up, down, or status\n');
        process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Migration error: ${error.message}\n`);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

async function generate() {
  console.log('🔧 Generating TypeScript types from database...\n');
  
  const config = findConfig();
  
  if (!config) {
    console.error('❌ No torm.config found');
    console.error('   Create torm.config.js first\n');
    process.exit(1);
  }

  const dbOptions = {
    host: config.dbCredentials?.host || process.env.TOONSTORE_HOST || 'localhost',
    port: config.dbCredentials?.port || Number(process.env.TOONSTORE_PORT) || 6379,
    url: config.dbCredentials?.url || process.env.TOONSTORE_URL,
  };

  const Redis = require('ioredis');
  const redis = dbOptions.url ? new Redis(dbOptions.url) : new Redis(dbOptions);

  try {
    console.log('📊 Scanning database for collections...\n');

    // Get all keys
    const allKeys = await redis.keys('toonstore:*');
    
    if (allKeys.length === 0) {
      console.log('⚠️  No data found in database');
      console.log('💡 Create some models and data first, then run generate\n');
      await redis.quit();
      process.exit(0);
    }

    // Group keys by model name
    const modelMap: { [key: string]: any[] } = {};
    
    for (const key of allKeys) {
      // Key format: toonstore:ModelName:id
      const parts = key.split(':');
      if (parts.length >= 3 && parts[0] === 'toonstore') {
        const modelName = parts[1];
        if (modelName === '_migrations') continue; // Skip internal keys
        
        if (!modelMap[modelName]) {
          modelMap[modelName] = [];
        }
        
        const data = await redis.get(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            modelMap[modelName].push(parsed);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    const modelNames = Object.keys(modelMap);
    
    if (modelNames.length === 0) {
      console.log('⚠️  No valid models found in database\n');
      await redis.quit();
      process.exit(0);
    }

    console.log(`✅ Found ${modelNames.length} model(s): ${modelNames.join(', ')}\n`);

    // Generate TypeScript interfaces
    let output = `/**
 * Auto-generated TypeScript types from ToonStoreDB
 * Generated: ${new Date().toISOString()}
 * 
 * ⚠️  DO NOT EDIT MANUALLY - This file is auto-generated
 * Run 'npx torm generate' to regenerate
 */

`;

    for (const modelName of modelNames) {
      const documents = modelMap[modelName];
      console.log(`📝 Analyzing ${modelName} (${documents.length} document${documents.length > 1 ? 's' : ''})...`);

      // Infer types from all documents
      const fieldTypes: { [key: string]: Set<string> } = {};
      
      for (const doc of documents) {
        for (const [field, value] of Object.entries(doc)) {
          if (!fieldTypes[field]) {
            fieldTypes[field] = new Set();
          }
          fieldTypes[field].add(inferType(value));
        }
      }

      // Generate interface - capitalize first letter for TypeScript convention
      const interfaceName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
      output += `export interface ${interfaceName} {\n`;
      
      // Sort fields: _id and metadata first, then alphabetically
      const fields = Object.keys(fieldTypes).sort((a, b) => {
        if (a.startsWith('_') && !b.startsWith('_')) return -1;
        if (!a.startsWith('_') && b.startsWith('_')) return 1;
        return a.localeCompare(b);
      });

      for (const field of fields) {
        const types = Array.from(fieldTypes[field]);
        const typeStr = types.length > 1 ? types.join(' | ') : types[0];
        
        // Check if field is optional (not present in all documents)
        const isOptional = documents.some(doc => !(field in doc));
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

    console.log(`\n✅ Generated types for ${modelNames.length} model(s)`);
    console.log(`📄 Output: ${outputFile}\n`);
    
    console.log('💡 Usage:');
    const interfaceNames = modelNames.map(name => name.charAt(0).toUpperCase() + name.slice(1));
    console.log(`   import { ${interfaceNames.join(', ')} } from './generated/torm-types';\n`);

    await redis.quit();
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`);
    await redis.quit();
    process.exit(1);
  }
}

function inferType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  const type = typeof value;
  
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  
  if (Array.isArray(value)) {
    if (value.length === 0) return 'any[]';
    
    // Infer array element types
    const elementTypes = new Set(value.map(inferType));
    if (elementTypes.size === 1) {
      return `${Array.from(elementTypes)[0]}[]`;
    }
    return `(${Array.from(elementTypes).join(' | ')})[]`;
  }
  
  if (type === 'object') return 'any'; // Could be more sophisticated
  
  return 'any';
}

function detectTypeScriptProject(): boolean {
  const cwd = process.cwd();
  
  // Check for tsconfig.json
  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
    return true;
  }
  
  // Check package.json for TypeScript
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      
      // Check dependencies
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      
      if (allDeps['typescript'] || allDeps['@types/node']) {
        return true;
      }
      
      // Check if main/types field points to .ts files
      if (pkg.main?.endsWith('.ts') || pkg.types?.endsWith('.ts')) {
        return true;
      }
    } catch (e) {
      // Invalid package.json, assume JS
    }
  }
  
  // Default to JavaScript
  return false;
}

function checkTypeScriptLoader(): boolean {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      
      return !!(allDeps['tsx'] || allDeps['ts-node']);
    } catch (e) {
      return false;
    }
  }
  return false;
}

function createTypeScriptConfig(): void {
  const config = `/**
 * TORM Configuration
 * Define your ToonStoreDB connection here
 */

export default {
  // ToonStoreDB connection
  dbCredentials: {
    host: 'localhost',
    port: 6379,
    // For cloud/remote databases:
    // password: process.env.TOONSTORE_PASSWORD,
    // url: 'redis://user:pass@host:port',
  },

  // Studio configuration
  studio: {
    port: 4983,
  },
  
  // Migrations directory (optional)
  migrations: {
    directory: './migrations',
  },
};
`;
  
  fs.writeFileSync(path.join(process.cwd(), 'torm.config.ts'), config);
  console.log('📄 Created: torm.config.ts');
}

function createJavaScriptConfig(): void {
  const config = `/**
 * TORM Configuration
 * Define your ToonStoreDB connection here
 */

module.exports = {
  // ToonStoreDB connection
  dbCredentials: {
    host: 'localhost',
    port: 6379,
    // For cloud/remote databases:
    // password: process.env.TOONSTORE_PASSWORD,
    // url: 'redis://user:pass@host:port',
  },

  // Studio configuration
  studio: {
    port: 4983,
  },
  
  // Migrations directory (optional)
  migrations: {
    directory: './migrations',
  },
};
`;
  
  fs.writeFileSync(path.join(process.cwd(), 'torm.config.js'), config);
  console.log('📄 Created: torm.config.js');
}

// Main CLI logic
const fullCommand = command || '';

if (fullCommand.startsWith('migrate:')) {
  migrate();
} else {
  switch (command) {
    case 'studio':
      studio();
      break;
    case 'generate':
      generate();
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`❌ Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
}
