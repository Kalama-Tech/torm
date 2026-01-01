//! Migration Example
//!
//! Demonstrates how to use migrations with TORM

use torm::{MigrationManager, TormDb};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 TORM Migration Example\n");

    // Connect to ToonStore
    println!("Connecting to ToonStore...");
    let db = TormDb::connect("redis://localhost:6379").await?;
    println!("✅ Connected!\n");

    // Create migration manager
    let mut manager = MigrationManager::new();

    // Define migrations
    manager.add_migration(
        "001",
        "create_users_collection",
        |_db| {
            println!("  Running: Create users collection...");
            Ok(())
        },
        |_db| {
            println!("  Rollback: Remove users collection...");
            Ok(())
        },
    );

    manager.add_migration(
        "002",
        "create_products_collection",
        |_db| {
            println!("  Running: Create products collection...");
            Ok(())
        },
        |_db| {
            println!("  Rollback: Remove products collection...");
            Ok(())
        },
    );

    manager.add_migration(
        "003",
        "add_user_indexes",
        |_db| {
            println!("  Running: Add user indexes...");
            Ok(())
        },
        |_db| {
            println!("  Rollback: Remove user indexes...");
            Ok(())
        },
    );

    // Check status before
    println!("Migration status before:");
    let status = manager.status(&db).await?;
    for (id, state) in &status {
        let status_str = match state {
            torm::MigrationStatus::Applied { name, applied_at } => {
                format!("{} - Applied at {}", name, applied_at)
            }
            torm::MigrationStatus::Pending { name } => {
                format!("{} - Pending", name)
            }
        };
        println!("  [{}] {}", id, status_str);
    }
    println!();

    // Run migrations
    println!("Running migrations...");
    let applied = manager.migrate(&db).await?;
    if !applied.is_empty() {
        println!("✅ Applied migrations: {}\n", applied.join(", "));
    } else {
        println!("✅ No pending migrations\n");
    }

    // Check status after
    println!("Migration status after:");
    let status = manager.status(&db).await?;
    for (id, state) in &status {
        let status_str = match state {
            torm::MigrationStatus::Applied { name, applied_at } => {
                format!("{} - Applied at {}", name, applied_at)
            }
            torm::MigrationStatus::Pending { name } => {
                format!("{} - Pending", name)
            }
        };
        println!("  [{}] {}", id, status_str);
    }
    println!();

    // Rollback last migration
    println!("Rolling back last migration...");
    let rolled_back = manager.rollback(&db, 1).await?;
    if !rolled_back.is_empty() {
        println!("✅ Rolled back: {}\n", rolled_back.join(", "));
    } else {
        println!("✅ No migrations to rollback\n");
    }

    // Final status
    println!("Final migration status:");
    let status = manager.status(&db).await?;
    for (id, state) in &status {
        let status_str = match state {
            torm::MigrationStatus::Applied { name, applied_at } => {
                format!("{} - Applied at {}", name, applied_at)
            }
            torm::MigrationStatus::Pending { name } => {
                format!("{} - Pending", name)
            }
        };
        println!("  [{}] {}", id, status_str);
    }

    println!("\n🎉 Migration example completed!");

    Ok(())
}
