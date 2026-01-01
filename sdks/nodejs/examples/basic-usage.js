/**
 * Basic Usage Example for @toonstore/torm
 * 
 * Run: node examples/basic-usage.js
 * 
 * Make sure TORM server is running:
 *   cargo run --package torm-server --release
 */

const { TormClient } = require('../dist/index');

// Define User interface
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  website?: string;
}

async function main() {
  console.log('🚀 TORM Node.js SDK - Basic Usage Example\n');

  // 1. Create client
  console.log('Connecting to TORM server...');
  const torm = new TormClient({
    baseURL: 'http://localhost:3001',
    timeout: 5000,
  });

  // Check server health
  const health = await torm.health();
  console.log('✅ Server health:', health);
  console.log();

  // 2. Define model with schema
  console.log('Creating User model...');
  const User = torm.model<User>('User', {
    name: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 50,
    },
    email: {
      type: 'string',
      required: true,
      email: true,
    },
    age: {
      type: 'number',
      required: true,
      min: 13,
      max: 120,
    },
    website: {
      type: 'string',
      url: true,
    },
  });
  console.log('✅ User model created\n');

  // 3. Create documents
  console.log('Creating users...');
  
  const alice = await User.create({
    id: 'user:1',
    name: 'Alice',
    email: 'alice@example.com',
    age: 30,
    website: 'https://alice.dev',
  });
  console.log('✅ Created:', alice);

  const bob = await User.create({
    id: 'user:2',
    name: 'Bob',
    email: 'bob@example.com',
    age: 25,
  });
  console.log('✅ Created:', bob);

  const charlie = await User.create({
    id: 'user:3',
    name: 'Charlie',
    email: 'charlie@example.com',
    age: 35,
  });
  console.log('✅ Created:', charlie);
  console.log();

  // 4. Find all
  console.log('Finding all users...');
  const allUsers = await User.find();
  console.log(`✅ Found ${allUsers.length} users:`, allUsers.map(u => u.name));
  console.log();

  // 5. Find by ID
  console.log('Finding user by ID...');
  const foundUser = await User.findById('user:1');
  console.log('✅ Found user:', foundUser);
  console.log();

  // 6. Query with filters
  console.log('Querying users (age >= 30)...');
  const adults = await User.query()
    .filter('age', 'gte', 30)
    .exec();
  console.log(`✅ Found ${adults.length} users:`, adults.map(u => `${u.name} (${u.age})`));
  console.log();

  // 7. Query with sorting
  console.log('Querying users sorted by age...');
  const sortedUsers = await User.query()
    .sort('age', 'desc')
    .exec();
  console.log('✅ Sorted by age (desc):', sortedUsers.map(u => `${u.name} (${u.age})`));
  console.log();

  // 8. Query with pagination
  console.log('Querying with pagination (limit 2, skip 1)...');
  const pagedUsers = await User.query()
    .sort('name', 'asc')
    .skip(1)
    .limit(2)
    .exec();
  console.log('✅ Paged results:', pagedUsers.map(u => u.name));
  console.log();

  // 9. Update document
  console.log('Updating user...');
  const updated = await User.update('user:1', {
    age: 31,
    website: 'https://alice.com',
  });
  console.log('✅ Updated user:', updated);
  console.log();

  // 10. Count documents
  console.log('Counting users...');
  const count = await User.count();
  console.log(`✅ Total users: ${count}`);
  console.log();

  // 11. Validation test
  console.log('Testing validation (invalid email)...');
  try {
    await User.create({
      id: 'user:4',
      name: 'Invalid',
      email: 'not-an-email',
      age: 25,
    });
    console.log('❌ Validation should have failed');
  } catch (error: any) {
    console.log('✅ Validation caught:', error.message);
  }
  console.log();

  // 12. Validation test (age too young)
  console.log('Testing validation (age too young)...');
  try {
    await User.create({
      id: 'user:5',
      name: 'Young',
      email: 'young@example.com',
      age: 10,
    });
    console.log('❌ Validation should have failed');
  } catch (error: any) {
    console.log('✅ Validation caught:', error.message);
  }
  console.log();

  // 13. Delete documents
  console.log('Deleting users...');
  await User.delete('user:1');
  await User.delete('user:2');
  await User.delete('user:3');
  console.log('✅ Deleted all users');
  console.log();

  // Verify deletion
  const remaining = await User.count();
  console.log(`✅ Remaining users: ${remaining}`);

  console.log('\n🎉 Example completed successfully!');
}

// Run example
main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
