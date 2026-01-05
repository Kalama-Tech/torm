/**
 * @toonstore/torm - ToonStore ORM Client for Node.js
 * 
 * A Mongoose-style ORM client for ToonStore connecting directly to Redis
 */

import Redis, { RedisOptions } from 'ioredis';

// ============================================================================
// Types
// ============================================================================

export interface TormClientOptions extends RedisOptions {
  host?: string;
  port?: number;
  url?: string; // Redis connection URL (e.g., redis://localhost:6379)
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not_in';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  sort?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  skip?: number;
}

export interface ValidationRule {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  validate?: (value: any) => boolean | Promise<boolean>;
}

export interface ModelSchema {
  [key: string]: ValidationRule;
}

export interface ModelOptions {
  collection?: string;
  validate?: boolean;
}

// ============================================================================
// TormClient
// ============================================================================

export class TormClient {
  private redis: Redis;
  private connected: boolean = false;

  constructor(options: TormClientOptions = {}) {
    const redisOptions: RedisOptions = {
      host: options.host || 'localhost',
      port: options.port || 6379,
      ...options,
    };

    if (options.url) {
      this.redis = new Redis(options.url, redisOptions);
    } else {
      this.redis = new Redis(redisOptions);
    }

    this.redis.on('connect', () => {
      this.connected = true;
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
      this.connected = false;
    });
  }

  /**
   * Create a new model class
   */
  model<T extends Record<string, any>>(
    name: string,
    schema?: ModelSchema,
    options?: ModelOptions
  ): Model<T> {
    return new Model<T>(this, name, schema, options);
  }

  /**
   * Get Redis client instance
   */
  getRedis(): Redis {
    return this.redis;
  }

  /**
   * Check connection health
   */
  async health(): Promise<{ status: string; connected: boolean }> {
    try {
      await this.redis.ping();
      return { status: 'ok', connected: true };
    } catch (error) {
      return { status: 'error', connected: false };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================================================
// Model
// ============================================================================

export class Model<T extends Record<string, any>> {
  private client: TormClient;
  private collectionName: string;
  private schema?: ModelSchema;
  private options: ModelOptions;

  constructor(
    client: TormClient,
    name: string,
    schema?: ModelSchema,
    options?: ModelOptions
  ) {
    this.client = client;
    this.collectionName = options?.collection || name.toLowerCase();
    this.schema = schema;
    this.options = { validate: true, ...options };
  }

  /**
   * Get the Redis key pattern for this collection
   */
  private getKeyPattern(id?: string): string {
    return id ? `toonstore:${this.collectionName}:${id}` : `toonstore:${this.collectionName}:*`;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new document
   */
  async create(data: Partial<T>): Promise<T & { _id: string }> {
    if (this.options.validate && this.schema) {
      await this.validate(data);
    }

    const id = this.generateId();
    const document: T & { _id: string } = {
      ...(data as T),
      _id: id,
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString(),
    } as any;

    const key = this.getKeyPattern(id);
    await this.client.getRedis().set(key, JSON.stringify(document));

    return document;
  }

  /**
   * Find all documents
   */
  async find(): Promise<Array<T & { _id: string }>> {
    const redis = this.client.getRedis();
    const pattern = this.getKeyPattern();
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const values = await redis.mget(...keys);
    return values
      .filter((v): v is string => v !== null)
      .map(v => JSON.parse(v));
  }

  /**
   * Find document by ID
   */
  async findById(id: string): Promise<(T & { _id: string }) | null> {
    const key = this.getKeyPattern(id);
    const value = await this.client.getRedis().get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  }

  /**
   * Find one document matching criteria
   */
  async findOne(filter: Partial<T>): Promise<(T & { _id: string }) | null> {
    const documents = await this.find();
    
    for (const doc of documents) {
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (doc[key as keyof T] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return doc;
      }
    }

    return null;
  }

  /**
   * Update document by ID
   */
  async update(id: string, data: Partial<T>): Promise<(T & { _id: string }) | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    if (this.options.validate && this.schema) {
      await this.validate(data);
    }

    const updated = {
      ...existing,
      ...data,
      _updatedAt: new Date().toISOString(),
    };

    const key = this.getKeyPattern(id);
    await this.client.getRedis().set(key, JSON.stringify(updated));

    return updated;
  }

  /**
   * Delete document by ID
   */
  async delete(id: string): Promise<boolean> {
    const key = this.getKeyPattern(id);
    const result = await this.client.getRedis().del(key);
    return result > 0;
  }

  /**
   * Count documents
   */
  async count(): Promise<number> {
    const keys = await this.client.getRedis().keys(this.getKeyPattern());
    return keys.length;
  }

  /**
   * Query documents with filters
   */
  query(): QueryBuilder<T> {
    return new QueryBuilder<T>(this);
  }

  /**
   * Delete all documents in collection
   */
  async deleteMany(filter?: Partial<T>): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      // Delete all documents in collection
      const keys = await this.client.getRedis().keys(this.getKeyPattern());
      if (keys.length === 0) return 0;
      await this.client.getRedis().del(...keys);
      return keys.length;
    }

    // Delete documents matching filter
    const documents = await this.find();
    let deleted = 0;

    for (const doc of documents) {
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (doc[key as keyof T] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        await this.delete(doc._id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Validate data against schema
   */
  private async validate(data: Partial<T>): Promise<void> {
    if (!this.schema) return;

    for (const [field, rules] of Object.entries(this.schema)) {
      const value = data[field as keyof T];

      // Required check
      if (rules.required && (value === undefined || value === null)) {
        throw new Error(`Validation error: Field '${field}' is required`);
      }

      // Skip validation if value is undefined/null and not required
      if (value === undefined || value === null) continue;

      // Type check
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          throw new Error(
            `Validation error: Field '${field}' must be of type ${rules.type}`
          );
        }
      }

      // String validations
      if (typeof value === 'string') {
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          throw new Error(
            `Validation error: Field '${field}' must be at least ${rules.minLength} characters`
          );
        }

        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          throw new Error(
            `Validation error: Field '${field}' must be at most ${rules.maxLength} characters`
          );
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          throw new Error(
            `Validation error: Field '${field}' does not match required pattern`
          );
        }

        if (rules.email && !this.isValidEmail(value)) {
          throw new Error(
            `Validation error: Field '${field}' must be a valid email`
          );
        }

        if (rules.url && !this.isValidUrl(value)) {
          throw new Error(
            `Validation error: Field '${field}' must be a valid URL`
          );
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          throw new Error(
            `Validation error: Field '${field}' must be at least ${rules.min}`
          );
        }

        if (rules.max !== undefined && value > rules.max) {
          throw new Error(
            `Validation error: Field '${field}' must be at most ${rules.max}`
          );
        }
      }

      // Custom validation
      if (rules.validate) {
        const isValid = await rules.validate(value);
        if (!isValid) {
          throw new Error(
            `Validation error: Field '${field}' failed custom validation`
          );
        }
      }
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// QueryBuilder
// ============================================================================

export class QueryBuilder<T extends Record<string, any>> {
  private model: Model<T>;
  private filterConditions: QueryFilter[] = [];
  private sortOptions?: { field: string; order: 'asc' | 'desc' };
  private limitValue?: number;
  private skipValue?: number;

  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Add filter condition
   */
  where(field: string, operator: QueryFilter['operator'], value: any): this {
    this.filterConditions.push({ field, operator, value });
    return this;
  }

  /**
   * Shorthand for equals filter
   */
  equals(field: string, value: any): this {
    return this.where(field, 'eq', value);
  }

  /**
   * Sort results
   */
  sort(field: string, order: 'asc' | 'desc' = 'asc'): this {
    this.sortOptions = { field, order };
    return this;
  }

  /**
   * Limit number of results
   */
  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * Skip number of results
   */
  skip(value: number): this {
    this.skipValue = value;
    return this;
  }

  /**
   * Execute the query
   */
  async exec(): Promise<Array<T & { _id: string }>> {
    let results = await this.model.find();

    // Apply filters
    if (this.filterConditions.length > 0) {
      results = results.filter(doc => {
        return this.filterConditions.every(filter => {
          const fieldValue = doc[filter.field as keyof T];
          
          switch (filter.operator) {
            case 'eq':
              return fieldValue === filter.value;
            case 'ne':
              return fieldValue !== filter.value;
            case 'gt':
              return fieldValue > filter.value;
            case 'gte':
              return fieldValue >= filter.value;
            case 'lt':
              return fieldValue < filter.value;
            case 'lte':
              return fieldValue <= filter.value;
            case 'contains':
              return String(fieldValue).includes(String(filter.value));
            case 'in':
              return Array.isArray(filter.value) && filter.value.includes(fieldValue);
            case 'not_in':
              return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
            default:
              return false;
          }
        });
      });
    }

    // Apply sorting
    if (this.sortOptions) {
      const { field, order } = this.sortOptions;
      results.sort((a, b) => {
        const aVal = a[field as keyof T];
        const bVal = b[field as keyof T];
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply skip
    if (this.skipValue) {
      results = results.slice(this.skipValue);
    }

    // Apply limit
    if (this.limitValue) {
      results = results.slice(0, this.limitValue);
    }

    return results;
  }

  /**
   * Get count of matching documents
   */
  async count(): Promise<number> {
    const results = await this.exec();
    return results.length;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default TormClient;
