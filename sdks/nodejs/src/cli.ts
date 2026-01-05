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
        if (configPath.endsWith('.js')) {
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
  
  if (!config) {
    console.log('⚠️  No torm.config.ts found in current directory\n');
    console.log('Creating a default config for you...\n');
    
    // Create example config
    const exampleConfig = `/**
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
    port: 4983, // Studio port (like Drizzle)
  },
};
`;
    
    fs.writeFileSync(path.join(process.cwd(), 'torm.config.ts'), exampleConfig);
    console.log('✅ Created torm.config.ts');
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
  console.log('⚠️  This feature is coming soon!');
  console.log('💡 For now, define types manually in your code.\n');
  process.exit(0);
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
