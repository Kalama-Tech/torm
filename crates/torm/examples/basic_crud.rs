//! Basic CRUD example with TORM

use serde::{Deserialize, Serialize};
use torm::{Model, TormDb};

#[derive(Model, Serialize, Deserialize, Debug)]
struct User {
    #[id]
    id: String,
    name: String,
    email: String,
    age: Option<u32>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 TORM Basic CRUD Example\n");

    // Connect to ToonStore
    println!("Connecting to ToonStore...");
    let db = TormDb::connect("redis://localhost:6379").await?;
    println!("✅ Connected!\n");

    // CREATE
    println!("Creating user...");
    let user = User {
        id: "user:1".to_string(),
        name: "John Doe".to_string(),
        email: "john@example.com".to_string(),
        age: Some(30),
    };
    user.save(&db).await?;
    println!("✅ User created: {:?}\n", user);

    // READ
    println!("Reading user...");
    let found_user = User::find_by_id(&db, "user:1").await?;
    println!("✅ User found: {:?}\n", found_user);

    // UPDATE
    println!("Updating user...");
    let mut updated_user = found_user;
    updated_user.email = "john.doe@example.com".to_string();
    updated_user.save(&db).await?;
    println!("✅ User updated: {:?}\n", updated_user);

    // CHECK EXISTS
    println!("Checking if user exists...");
    let exists = User::exists(&db, "user:1").await?;
    println!("✅ User exists: {}\n", exists);

    // DELETE
    println!("Deleting user...");
    updated_user.delete(&db).await?;
    println!("✅ User deleted\n");

    // VERIFY DELETION
    println!("Verifying deletion...");
    let exists_after = User::exists(&db, "user:1").await?;
    println!("✅ User exists after deletion: {}\n", exists_after);

    println!("🎉 Example completed!");
    Ok(())
}
