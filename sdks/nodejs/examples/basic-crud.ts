import { TormClient, Model } from '../src';

interface UserData {
  id?: string;
  name: string;
  email: string;
  age?: number;
}

class User extends Model<UserData> {
  get name() {
    return this.get('name');
  }
  set name(value: string) {
    this.set('name', value);
  }
  
  get email() {
    return this.get('email');
  }
  set email(value: string) {
    this.set('email', value);
  }
  
  get age() {
    return this.get('age');
  }
  set age(value: number | undefined) {
    this.set('age', value);
  }
}

async function main() {
  const client = new TormClient({ baseURL: 'http://localhost:3001' });
  User.setClient(client);
  User.setCollection('users');

  console.log('🚀 TORM Node.js SDK Example\n');

  // Create a user
  console.log('Creating user...');
  const user = new User({ id: 'user:1', name: 'John Doe', email: 'john@example.com', age: 30 });
  await user.save();
  console.log(`✅ Created: ${JSON.stringify(user.toJSON())}\n`);

  // Find by ID
  console.log('Finding user by ID...');
  const found = await User.findById('user:1');
  console.log(`✅ Found: ${JSON.stringify(found?.toJSON())}\n`);

  // Update user
  console.log('Updating user...');
  if (found) {
    found.age = 31;
    await found.save();
    console.log(`✅ Updated: ${JSON.stringify(found.toJSON())}\n`);
  }

  // Create more users
  console.log('Creating more users...');
  const user2 = new User({ id: 'user:2', name: 'Jane Smith', email: 'jane@example.com', age: 28 });
  const user3 = new User({ id: 'user:3', name: 'Bob Wilson', email: 'bob@example.com', age: 35 });
  await user2.save();
  await user3.save();
  console.log('✅ Created 2 more users\n');

  // Find all users
  console.log('Finding all users...');
  const users = await User.find();
  console.log(`✅ Found ${users.length} users:`);
  for (const u of users) {
    console.log(`   - ${u.get('name')} (${u.get('email')})`);
  }
  console.log();

  // Count users
  const count = await User.count();
  console.log(`✅ Total users: ${count}\n`);

  // Delete user
  console.log('Deleting user...');
  await user.delete();
  console.log('✅ Deleted user:1\n');

  // Verify deletion
  const deleted = await User.findById('user:1');
  console.log(`✅ User deleted: ${deleted === null}\n`);
}

main().catch(console.error);
