"""
TORM Python SDK - Basic Usage Example

This example demonstrates how to use the ToonStore ORM Python client.
"""

from toonstore_torm import TormClient

def main():
    print("🚀 TORM Python SDK - Basic Usage Example\n")
    
    # 1. Connect to TORM server
    print("Connecting to TORM server...")
    torm = TormClient('http://localhost:3001')
    
    # Check health
    try:
        health = torm.health()
        print(f"✅ Connected! Status: {health.get('status', 'unknown')}\n")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return
    
    # 2. Define User model with validation
    print("Defining User model...")
    User = torm.model('User', {
        'name': {'type': 'str', 'required': True, 'min_length': 3},
        'email': {'type': 'str', 'required': True, 'email': True},
        'age': {'type': 'int', 'min': 13, 'max': 120},
        'active': {'type': 'bool'}
    })
    print("✅ User model defined\n")
    
    # 3. Create users
    print("Creating users...")
    try:
        alice = User.create({
            'id': 'user:alice',
            'name': 'Alice Smith',
            'email': 'alice@example.com',
            'age': 30,
            'active': True
        })
        print(f"✅ Created: {alice.get('name')}")
        
        bob = User.create({
            'id': 'user:bob',
            'name': 'Bob Johnson',
            'email': 'bob@example.com',
            'age': 25,
            'active': True
        })
        print(f"✅ Created: {bob.get('name')}")
        
        charlie = User.create({
            'id': 'user:charlie',
            'name': 'Charlie Brown',
            'email': 'charlie@example.com',
            'age': 35,
            'active': False
        })
        print(f"✅ Created: {charlie.get('name')}\n")
    except Exception as e:
        print(f"❌ Failed to create user: {e}\n")
    
    # 4. Find all users
    print("Finding all users...")
    try:
        all_users = User.find()
        print(f"✅ Found {len(all_users)} users")
        for user in all_users:
            print(f"   - {user.get('name')} ({user.get('email')})")
        print()
    except Exception as e:
        print(f"❌ Failed to find users: {e}\n")
    
    # 5. Find user by ID
    print("Finding user by ID...")
    try:
        user = User.find_by_id('user:alice')
        if user:
            print(f"✅ Found: {user.get('name')}\n")
        else:
            print("❌ User not found\n")
    except Exception as e:
        print(f"❌ Failed to find user: {e}\n")
    
    # 6. Query with filters
    print("Querying active users over 25...")
    try:
        results = User.query() \
            .filter('active', 'eq', True) \
            .filter('age', 'gte', 25) \
            .sort('age', 'asc') \
            .exec()
        
        print(f"✅ Found {len(results)} matching users:")
        for user in results:
            print(f"   - {user.get('name')}, age {user.get('age')}")
        print()
    except Exception as e:
        print(f"❌ Query failed: {e}\n")
    
    # 7. Update user
    print("Updating user...")
    try:
        updated = User.update('user:bob', {'age': 26})
        print(f"✅ Updated: {updated.get('name')}, new age: {updated.get('age')}\n")
    except Exception as e:
        print(f"❌ Failed to update user: {e}\n")
    
    # 8. Count users
    print("Counting users...")
    try:
        count = User.count()
        print(f"✅ Total users: {count}\n")
    except Exception as e:
        print(f"❌ Failed to count users: {e}\n")
    
    # 9. Validation demo
    print("Testing validation...")
    try:
        # This should fail - email invalid
        User.create({
            'id': 'user:invalid',
            'name': 'Invalid User',
            'email': 'not-an-email',
            'age': 30
        })
        print("❌ Validation didn't catch invalid email\n")
    except Exception as e:
        print(f"✅ Validation caught error: {e}\n")
    
    # 10. Delete user
    print("Deleting user...")
    try:
        success = User.delete('user:charlie')
        if success:
            print("✅ User deleted successfully\n")
        else:
            print("❌ Failed to delete user\n")
    except Exception as e:
        print(f"❌ Failed to delete user: {e}\n")
    
    # 11. Verify deletion
    print("Verifying deletion...")
    try:
        user = User.find_by_id('user:charlie')
        if user is None:
            print("✅ User successfully deleted\n")
        else:
            print("❌ User still exists\n")
    except Exception as e:
        print(f"❌ Failed to verify: {e}\n")
    
    # Close connection
    torm.close()
    print("🎉 Example completed!")


if __name__ == '__main__':
    main()
