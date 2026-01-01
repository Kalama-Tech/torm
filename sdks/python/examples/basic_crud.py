"""Example: Basic CRUD operations with TORM Python SDK"""

import asyncio
from toonstore import TormClient, Model


class User(Model):
    """User model"""
    
    def __init__(self, id=None, name=None, email=None, age=None):
        self.id = id
        self.name = name
        self.email = email
        self.age = age


async def main():
    # Connect to TORM server
    async with TormClient("http://localhost:3001") as client:
        # Set up model
        User.set_client(client)
        User.set_collection("users")
        
        print("🚀 TORM Python SDK Example\n")
        
        # Create a user
        print("Creating user...")
        user = User(
            id="user:1",
            name="John Doe",
            email="john@example.com",
            age=30
        )
        await user.save()
        print(f"✅ Created: {user}\n")
        
        # Find by ID
        print("Finding user by ID...")
        found = await User.find_by_id("user:1")
        print(f"✅ Found: {found}\n")
        
        # Update user
        print("Updating user...")
        found.age = 31
        await found.save()
        print(f"✅ Updated: {found}\n")
        
        # Create more users
        print("Creating more users...")
        user2 = User(id="user:2", name="Jane Smith", email="jane@example.com", age=28)
        user3 = User(id="user:3", name="Bob Wilson", email="bob@example.com", age=35)
        await user2.save()
        await user3.save()
        print("✅ Created 2 more users\n")
        
        # Find all users
        print("Finding all users...")
        users = await User.find()
        print(f"✅ Found {len(users)} users:")
        for u in users:
            print(f"   - {u.name} ({u.email})")
        print()
        
        # Count users
        count = await User.count()
        print(f"✅ Total users: {count}\n")
        
        # Delete user
        print("Deleting user...")
        await user.delete()
        print("✅ Deleted user:1\n")
        
        # Verify deletion
        deleted = await User.find_by_id("user:1")
        print(f"✅ User deleted: {deleted is None}\n")


if __name__ == "__main__":
    asyncio.run(main())
