/**
 * TORM Node.js SDK Tests
 * 
 * Tests for ToonStore ORM Client
 */

import { TormClient, Model } from '../src/index';

// Test configuration
const TEST_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

interface TestUser {
  name: string;
  email: string;
  age: number;
  website?: string;
}

interface TestProduct {
  name: string;
  price: number;
  stock: number;
  sku: string;
}

describe('TormClient', () => {
  let torm: TormClient;

  beforeAll(() => {
    torm = new TormClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await torm.disconnect();
  });

  test('should connect to database', async () => {
    const health = await torm.health();
    expect(health.status).toBe('ok');
    expect(health.connected).toBe(true);
  });

  test('should check connection status', () => {
    expect(torm.isConnected()).toBe(true);
  });

  test('should create a model', () => {
    const User = torm.model<TestUser>('TestUser');
    expect(User).toBeInstanceOf(Model);
  });
});

describe('Model CRUD Operations', () => {
  let torm: TormClient;
  let User: Model<TestUser>;

  beforeAll(() => {
    torm = new TormClient(TEST_CONFIG);
    User = torm.model<TestUser>('TestUser', {
      name: { type: 'string', required: true, minLength: 3 },
      email: { type: 'string', required: true, email: true },
      age: { type: 'number', required: true, min: 13, max: 120 },
      website: { type: 'string', url: true },
    });
  });

  afterAll(async () => {
    await User.deleteMany();
    await torm.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany();
  });

  test('should create a document', async () => {
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      age: 30,
    });

    expect(user._id).toBeDefined();
    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.age).toBe(30);
    expect(user._createdAt).toBeDefined();
    expect(user._updatedAt).toBeDefined();
  });

  test('should find all documents', async () => {
    await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ name: 'Bob', email: 'bob@example.com', age: 25 });

    const users = await User.find();
    expect(users.length).toBe(2);
  });

  test('should find document by ID', async () => {
    const created = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      age: 30,
    });

    const found = await User.findById(created._id);
    expect(found).toBeDefined();
    expect(found?._id).toBe(created._id);
    expect(found?.name).toBe('Alice');
  });

  test('should find one document by filter', async () => {
    await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ name: 'Bob', email: 'bob@example.com', age: 25 });

    const found = await User.findOne({ email: 'bob@example.com' });
    expect(found).toBeDefined();
    expect(found?.name).toBe('Bob');
  });

  test('should update a document', async () => {
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      age: 30,
    });

    const updated = await User.update(user._id, { age: 31 });
    expect(updated).toBeDefined();
    expect(updated?.age).toBe(31);
    expect(updated?._updatedAt).not.toBe(user._updatedAt);
  });

  test('should delete a document', async () => {
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      age: 30,
    });

    const deleted = await User.delete(user._id);
    expect(deleted).toBe(true);

    const found = await User.findById(user._id);
    expect(found).toBeNull();
  });

  test('should count documents', async () => {
    await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ name: 'Bob', email: 'bob@example.com', age: 25 });

    const count = await User.count();
    expect(count).toBe(2);
  });

  test('should delete all documents', async () => {
    await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ name: 'Bob', email: 'bob@example.com', age: 25 });

    const deleted = await User.deleteMany();
    expect(deleted).toBe(2);

    const count = await User.count();
    expect(count).toBe(0);
  });

  test('should delete documents matching filter', async () => {
    await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ name: 'Bob', email: 'bob@example.com', age: 25 });
    await User.create({ name: 'Charlie', email: 'charlie@example.com', age: 25 });

    const deleted = await User.deleteMany({ age: 25 });
    expect(deleted).toBe(2);

    const remaining = await User.find();
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('Alice');
  });
});

describe('Validation', () => {
  let torm: TormClient;
  let User: Model<TestUser>;

  beforeAll(() => {
    torm = new TormClient(TEST_CONFIG);
    User = torm.model<TestUser>('TestUser', {
      name: { type: 'string', required: true, minLength: 3, maxLength: 50 },
      email: { type: 'string', required: true, email: true },
      age: { type: 'number', required: true, min: 13, max: 120 },
      website: { type: 'string', url: true },
    });
  });

  afterAll(async () => {
    await User.deleteMany();
    await torm.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany();
  });

  test('should validate required fields', async () => {
    await expect(
      User.create({ name: 'Alice', age: 30 } as any)
    ).rejects.toThrow('required');
  });

  test('should validate string minLength', async () => {
    await expect(
      User.create({ name: 'Al', email: 'alice@example.com', age: 30 })
    ).rejects.toThrow('at least 3 characters');
  });

  test('should validate string maxLength', async () => {
    await expect(
      User.create({
        name: 'A'.repeat(51),
        email: 'alice@example.com',
        age: 30,
      })
    ).rejects.toThrow('at most 50 characters');
  });

  test('should validate email format', async () => {
    await expect(
      User.create({ name: 'Alice', email: 'invalid-email', age: 30 })
    ).rejects.toThrow('valid email');
  });

  test('should validate URL format', async () => {
    await expect(
      User.create({
        name: 'Alice',
        email: 'alice@example.com',
        age: 30,
        website: 'not-a-url',
      })
    ).rejects.toThrow('valid URL');
  });

  test('should validate number min', async () => {
    await expect(
      User.create({ name: 'Alice', email: 'alice@example.com', age: 12 })
    ).rejects.toThrow('at least 13');
  });

  test('should validate number max', async () => {
    await expect(
      User.create({ name: 'Alice', email: 'alice@example.com', age: 121 })
    ).rejects.toThrow('at most 120');
  });

  test('should validate type', async () => {
    await expect(
      User.create({ name: 'Alice', email: 'alice@example.com', age: '30' } as any)
    ).rejects.toThrow('type number');
  });
});

describe('Query Builder', () => {
  let torm: TormClient;
  let User: Model<TestUser>;

  beforeAll(async () => {
    torm = new TormClient(TEST_CONFIG);
    User = torm.model<TestUser>('TestUser');

    await User.deleteMany();

    // Create test data
    await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ name: 'Bob', email: 'bob@example.com', age: 25 });
    await User.create({ name: 'Charlie', email: 'charlie@example.com', age: 35 });
    await User.create({ name: 'Diana', email: 'diana@example.com', age: 28 });
  });

  afterAll(async () => {
    await User.deleteMany();
    await torm.disconnect();
  });

  test('should filter with equals', async () => {
    const results = await User.query().where('age', 'eq', 30).exec();
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Alice');
  });

  test('should filter with greater than', async () => {
    const results = await User.query().where('age', 'gt', 30).exec();
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Charlie');
  });

  test('should filter with greater than or equal', async () => {
    const results = await User.query().where('age', 'gte', 30).exec();
    expect(results.length).toBe(2);
  });

  test('should filter with less than', async () => {
    const results = await User.query().where('age', 'lt', 30).exec();
    expect(results.length).toBe(2);
  });

  test('should filter with less than or equal', async () => {
    const results = await User.query().where('age', 'lte', 30).exec();
    expect(results.length).toBe(3);
  });

  test('should filter with contains', async () => {
    const results = await User.query()
      .where('email', 'contains', 'alice')
      .exec();
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Alice');
  });

  test('should chain multiple filters', async () => {
    const results = await User.query()
      .where('age', 'gte', 25)
      .where('age', 'lte', 30)
      .exec();
    expect(results.length).toBe(3);
  });

  test('should sort ascending', async () => {
    const results = await User.query().sort('age', 'asc').exec();
    expect(results[0].name).toBe('Bob');
    expect(results[3].name).toBe('Charlie');
  });

  test('should sort descending', async () => {
    const results = await User.query().sort('age', 'desc').exec();
    expect(results[0].name).toBe('Charlie');
    expect(results[3].name).toBe('Bob');
  });

  test('should limit results', async () => {
    const results = await User.query().limit(2).exec();
    expect(results.length).toBe(2);
  });

  test('should skip results', async () => {
    const results = await User.query()
      .sort('age', 'asc')
      .skip(2)
      .exec();
    expect(results.length).toBe(2);
    expect(results[0].age).toBeGreaterThanOrEqual(30);
  });

  test('should combine filter, sort, limit, and skip', async () => {
    const results = await User.query()
      .where('age', 'gte', 25)
      .sort('age', 'asc')
      .skip(1)
      .limit(2)
      .exec();
    expect(results.length).toBe(2);
    expect(results[0].age).toBe(28);
  });

  test('should count filtered results', async () => {
    const count = await User.query().where('age', 'gte', 30).count();
    expect(count).toBe(2);
  });

  test('should use equals shorthand', async () => {
    const results = await User.query().equals('name', 'Bob').exec();
    expect(results.length).toBe(1);
    expect(results[0].email).toBe('bob@example.com');
  });
});

describe('Custom Validation', () => {
  let torm: TormClient;
  let Product: Model<TestProduct>;

  beforeAll(() => {
    torm = new TormClient(TEST_CONFIG);
    Product = torm.model<TestProduct>('TestProduct', {
      name: { type: 'string', required: true },
      price: {
        type: 'number',
        required: true,
        min: 0,
        validate: (value) => value > 0,
      },
      stock: { type: 'number', required: true, min: 0 },
      sku: {
        type: 'string',
        required: true,
        pattern: /^[A-Z]{3}-\d{5}$/,
      },
    });
  });

  afterAll(async () => {
    await Product.deleteMany();
    await torm.disconnect();
  });

  beforeEach(async () => {
    await Product.deleteMany();
  });

  test('should validate with pattern', async () => {
    const product = await Product.create({
      name: 'Laptop',
      price: 999.99,
      stock: 10,
      sku: 'LAP-12345',
    });
    expect(product.sku).toBe('LAP-12345');
  });

  test('should reject invalid pattern', async () => {
    await expect(
      Product.create({
        name: 'Laptop',
        price: 999.99,
        stock: 10,
        sku: 'invalid',
      })
    ).rejects.toThrow('pattern');
  });

  test('should validate with custom function', async () => {
    await expect(
      Product.create({
        name: 'Laptop',
        price: 0,
        stock: 10,
        sku: 'LAP-12345',
      })
    ).rejects.toThrow('custom validation');
  });
});

console.log('✅ All TORM tests defined');
