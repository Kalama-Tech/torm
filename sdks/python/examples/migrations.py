"""Example: Database migrations with TORM Python SDK"""

import asyncio
from toonstore import TormClient, MigrationManager


async def main():
    # Connect to TORM server
    async with TormClient("http://localhost:3001") as client:
        manager = MigrationManager(client)
        
        print("🚀 TORM Migrations Example\n")
        
        # Define migrations
        async def create_users_up(client):
            print("  Running: Create users collection...")
            # In a real app, you might create indexes or default data
        
        async def create_users_down(client):
            print("  Rollback: Remove users collection...")
        
        async def create_products_up(client):
            print("  Running: Create products collection...")
        
        async def create_products_down(client):
            print("  Rollback: Remove products collection...")
        
        # Register migrations
        manager.add_migration(
            "001",
            "create_users",
            create_users_up,
            create_users_down
        )
        
        manager.add_migration(
            "002",
            "create_products",
            create_products_up,
            create_products_down
        )
        
        # Check status before
        print("Migration status before:")
        status = await manager.status()
        for id, state in status.items():
            print(f"  [{id}] {state}")
        print()
        
        # Run migrations
        print("Running migrations...")
        applied = await manager.migrate()
        if applied:
            print(f"✅ Applied migrations: {', '.join(applied)}\n")
        else:
            print("✅ No pending migrations\n")
        
        # Check status after
        print("Migration status after:")
        status = await manager.status()
        for id, state in status.items():
            print(f"  [{id}] {state}")
        print()
        
        # Rollback last migration
        print("Rolling back last migration...")
        rolled_back = await manager.rollback(steps=1)
        if rolled_back:
            print(f"✅ Rolled back: {', '.join(rolled_back)}\n")
        else:
            print("✅ No migrations to rollback\n")
        
        # Final status
        print("Final migration status:")
        status = await manager.status()
        for id, state in status.items():
            print(f"  [{id}] {state}")


if __name__ == "__main__":
    asyncio.run(main())
