/**
 * TORM Migration System
 * Handles data-shape migrations for schemaless ToonStoreDB
 */

import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
  name: string;
  timestamp: string;
  up: (client: Redis) => Promise<void>;
  down: (client: Redis) => Promise<void>;
}

export class MigrationRunner {
  private redis: Redis;
  private migrationsDir: string;
  private migrationKey = 'toonstore:_migrations';

  constructor(redisOptions: { host?: string; port?: number; url?: string }, migrationsDir?: string) {
    if (redisOptions.url) {
      this.redis = new Redis(redisOptions.url);
    } else {
      this.redis = new Redis({
        host: redisOptions.host || 'localhost',
        port: redisOptions.port || 6379,
      });
    }

    this.migrationsDir = migrationsDir || path.join(process.cwd(), 'migrations');
  }

  /**
   * Get list of applied migrations from database
   */
  async getAppliedMigrations(): Promise<string[]> {
    const data = await this.redis.get(this.migrationKey);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Save applied migrations to database
   */
  async saveAppliedMigrations(migrations: string[]): Promise<void> {
    await this.redis.set(this.migrationKey, JSON.stringify(migrations));
  }

  /**
   * Get list of migration files from directory
   */
  getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    return fs
      .readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
      .sort();
  }

  /**
   * Load a migration module
   */
  async loadMigration(filename: string): Promise<Migration> {
    const filePath = path.join(this.migrationsDir, filename);
    const module = require(filePath);
    const migration = module.default || module;

    if (!migration.up || !migration.down) {
      throw new Error(`Migration ${filename} must export up() and down() functions`);
    }

    const timestamp = filename.split('_')[0];
    const name = filename.replace(/\.(js|ts)$/, '');

    return {
      name,
      timestamp,
      up: migration.up,
      down: migration.down,
    };
  }

  /**
   * Get pending migrations that haven't been applied yet
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const files = this.getMigrationFiles();

    const pending: Migration[] = [];

    for (const file of files) {
      const migration = await this.loadMigration(file);
      if (!applied.includes(migration.name)) {
        pending.push(migration);
      }
    }

    return pending;
  }

  /**
   * Run pending migrations
   */
  async up(count?: number): Promise<void> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    const toRun = count ? pending.slice(0, count) : pending;
    const applied = await this.getAppliedMigrations();

    console.log(`\n📦 Running ${toRun.length} migration(s)...\n`);

    for (const migration of toRun) {
      try {
        console.log(`⏳ Running: ${migration.name}`);
        await migration.up(this.redis);
        applied.push(migration.name);
        await this.saveAppliedMigrations(applied);
        console.log(`✅ Applied: ${migration.name}\n`);
      } catch (error: any) {
        console.error(`❌ Failed: ${migration.name}`);
        console.error(`   ${error.message}\n`);
        throw error;
      }
    }

    console.log(`✅ All migrations applied successfully!\n`);
  }

  /**
   * Rollback last migration
   */
  async down(count: number = 1): Promise<void> {
    const applied = await this.getAppliedMigrations();

    if (applied.length === 0) {
      console.log('⚠️  No migrations to rollback');
      return;
    }

    const toRollback = applied.slice(-count);

    console.log(`\n📦 Rolling back ${toRollback.length} migration(s)...\n`);

    for (let i = toRollback.length - 1; i >= 0; i--) {
      const name = toRollback[i];
      const filename = this.getMigrationFiles().find(f => f.includes(name));

      if (!filename) {
        console.error(`❌ Migration file not found: ${name}`);
        continue;
      }

      try {
        const migration = await this.loadMigration(filename);
        console.log(`⏳ Rolling back: ${migration.name}`);
        await migration.down(this.redis);
        
        const index = applied.indexOf(name);
        applied.splice(index, 1);
        await this.saveAppliedMigrations(applied);
        
        console.log(`✅ Rolled back: ${migration.name}\n`);
      } catch (error: any) {
        console.error(`❌ Failed to rollback: ${name}`);
        console.error(`   ${error.message}\n`);
        throw error;
      }
    }

    console.log(`✅ Rollback completed!\n`);
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    const applied = await this.getAppliedMigrations();
    const files = this.getMigrationFiles();

    console.log('\n📋 Migration Status:\n');

    if (files.length === 0) {
      console.log('   No migration files found\n');
      return;
    }

    for (const file of files) {
      const migration = await this.loadMigration(file);
      const isApplied = applied.includes(migration.name);
      const status = isApplied ? '✅' : '⏸️ ';
      const label = isApplied ? 'Applied' : 'Pending';
      
      console.log(`   ${status} ${migration.name} - ${label}`);
    }

    console.log();
  }

  /**
   * Create a new migration file
   */
  async create(name: string): Promise<void> {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const filename = `${timestamp}_${name}.ts`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

import { Redis } from 'ioredis';

export default {
  async up(client: Redis) {
    // TODO: Implement forward migration
    // Example: Add a field to all documents
    /*
    const pattern = 'toonstore:User:*';
    const keys = await client.keys(pattern);
    
    for (const key of keys) {
      const data = JSON.parse(await client.get(key) || '{}');
      
      // Add new field with default value
      data.newField = data.newField ?? 'default';
      
      await client.set(key, JSON.stringify(data));
    }
    
    console.log(\`Updated \${keys.length} documents\`);
    */
  },

  async down(client: Redis) {
    // TODO: Implement rollback migration
    // Example: Remove the field
    /*
    const pattern = 'toonstore:User:*';
    const keys = await client.keys(pattern);
    
    for (const key of keys) {
      const data = JSON.parse(await client.get(key) || '{}');
      
      // Remove the field
      delete data.newField;
      
      await client.set(key, JSON.stringify(data));
    }
    
    console.log(\`Rolled back \${keys.length} documents\`);
    */
  },
};
`;

    fs.writeFileSync(filepath, template);

    console.log(`\n✅ Created migration: ${filename}`);
    console.log(`   Location: ${filepath}\n`);
    console.log(`📝 Edit the migration file and implement up() and down()\n`);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
