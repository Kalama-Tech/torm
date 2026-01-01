/**
 * @toonstore/torm - ToonStore ORM Client for Node.js
 * 
 * A Mongoose-style ORM client for ToonStore
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================================
// Types
// ============================================================================

export interface TormClientOptions {
  baseURL?: string;
  timeout?: number;
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
  private client: AxiosInstance;
  private baseURL: string;

  constructor(options: TormClientOptions = {}) {
    this.baseURL = options.baseURL || 'http://localhost:3001';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: options.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
      },
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
   * Get HTTP client instance
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Check server health
   */
  async health(): Promise<{ status: string; database?: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * Get server info
   */
  async info(): Promise<any> {
    const response = await this.client.get('/');
    return response.data;
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
   * Create a new document
   */
  async create(data: Partial<T>): Promise<T> {
    if (this.options.validate && this.schema) {
      this.validate(data);
    }

    const response = await this.client.getClient().post(
      `/api/${this.collectionName}`,
      { data }
    );

    return response.data.data as T;
  }

  /**
   * Find all documents
   */
  async find(): Promise<T[]> {
    const response = await this.client.getClient().get(
      `/api/${this.collectionName}`
    );

    return response.data.documents as T[];
  }

  /**
   * Find document by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const response = await this.client.getClient().get(
        `/api/${this.collectionName}/${id}`
      );

      return response.data as T;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update document by ID
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    if (this.options.validate && this.schema) {
      this.validate(data);
    }

    const response = await this.client.getClient().put(
      `/api/${this.collectionName}/${id}`,
      { data }
    );

    return response.data.data as T;
  }

  /**
   * Delete document by ID
   */
  async delete(id: string): Promise<boolean> {
    const response = await this.client.getClient().delete(
      `/api/${this.collectionName}/${id}`
    );

    return response.data.success === true;
  }

  /**
   * Count documents
   */
  async count(): Promise<number> {
    const response = await this.client.getClient().get(
      `/api/${this.collectionName}/count`
    );

    return response.data.count;
  }

  /**
   * Query documents with filters
   */
  query(): QueryBuilder<T> {
    return new QueryBuilder<T>(this.client, this.collectionName);
  }

  /**
   * Validate data against schema
   */
  private validate(data: Partial<T>): void {
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
            `Validation error: Field '${field}' does not match pattern`
          );
        }
        if (rules.email && !this.isEmail(value)) {
          throw new Error(
            `Validation error: Field '${field}' must be a valid email`
          );
        }
        if (rules.url && !this.isURL(value)) {
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
      if (rules.validate && !rules.validate(value)) {
        throw new Error(
          `Validation error: Field '${field}' failed custom validation`
        );
      }
    }
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isURL(value: string): boolean {
    return /^https?:\/\/.+/.test(value);
  }
}

// ============================================================================
// QueryBuilder
// ============================================================================

export class QueryBuilder<T> {
  private client: TormClient;
  private collectionName: string;
  private filters: QueryFilter[] = [];
  private sortField?: string;
  private sortOrder?: 'asc' | 'desc';
  private limitValue?: number;
  private skipValue?: number;

  constructor(client: TormClient, collectionName: string) {
    this.client = client;
    this.collectionName = collectionName;
  }

  /**
   * Add a filter
   */
  filter(
    field: string,
    operator: QueryFilter['operator'],
    value: any
  ): QueryBuilder<T> {
    this.filters.push({ field, operator, value });
    return this;
  }

  /**
   * Filter where field equals value
   */
  where(field: string, value: any): QueryBuilder<T> {
    return this.filter(field, 'eq', value);
  }

  /**
   * Sort results
   */
  sort(field: string, order: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    this.sortField = field;
    this.sortOrder = order;
    return this;
  }

  /**
   * Limit results
   */
  limit(n: number): QueryBuilder<T> {
    this.limitValue = n;
    return this;
  }

  /**
   * Skip results
   */
  skip(n: number): QueryBuilder<T> {
    this.skipValue = n;
    return this;
  }

  /**
   * Execute query
   */
  async exec(): Promise<T[]> {
    const queryOptions: any = {};

    if (this.filters.length > 0) {
      queryOptions.filters = this.filters;
    }
    if (this.sortField) {
      queryOptions.sort = { field: this.sortField, order: this.sortOrder };
    }
    if (this.limitValue !== undefined) {
      queryOptions.limit = this.limitValue;
    }
    if (this.skipValue !== undefined) {
      queryOptions.skip = this.skipValue;
    }

    const response = await this.client.getClient().post(
      `/api/${this.collectionName}/query`,
      queryOptions
    );

    let documents = response.data.documents as T[];

    // Apply client-side filtering (since server returns all for now)
    if (this.filters.length > 0) {
      documents = documents.filter((doc) => {
        return this.filters.every((filter) => {
          const value = doc[filter.field as keyof T];
          return this.matchesFilter(value, filter.operator, filter.value);
        });
      });
    }

    // Apply client-side sorting
    if (this.sortField) {
      documents.sort((a, b) => {
        const aVal = a[this.sortField as keyof T];
        const bVal = b[this.sortField as keyof T];
        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return this.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return documents;
  }

  /**
   * Count matching documents
   */
  async count(): Promise<number> {
    const documents = await this.exec();
    return documents.length;
  }

  private matchesFilter(value: any, operator: string, filterValue: any): boolean {
    switch (operator) {
      case 'eq':
        return value === filterValue;
      case 'ne':
        return value !== filterValue;
      case 'gt':
        return value > filterValue;
      case 'gte':
        return value >= filterValue;
      case 'lt':
        return value < filterValue;
      case 'lte':
        return value <= filterValue;
      case 'contains':
        return String(value).includes(String(filterValue));
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'not_in':
        return Array.isArray(filterValue) && !filterValue.includes(value);
      default:
        return false;
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default TormClient;
