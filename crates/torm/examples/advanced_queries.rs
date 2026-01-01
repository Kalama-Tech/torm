//! Advanced queries example with TORM

use serde::{Deserialize, Serialize};
use torm::{Model, Query, SortOrder, TormDb};

#[derive(Model, Serialize, Deserialize, Debug, Clone)]
struct User {
    #[id]
    id: String,
    name: String,
    email: String,
    age: u32,
    active: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 TORM Advanced Queries Example\n");

    // Connect to ToonStore
    println!("Connecting to ToonStore...");
    let db = TormDb::connect("redis://localhost:6379").await?;
    println!("✅ Connected!\n");

    // Create sample users
    println!("Creating sample users...");
    let users = vec![
        User {
            id: "user:1".into(),
            name: "Alice".into(),
            email: "alice@example.com".into(),
            age: 25,
            active: true,
        },
        User {
            id: "user:2".into(),
            name: "Bob".into(),
            email: "bob@example.com".into(),
            age: 30,
            active: true,
        },
        User {
            id: "user:3".into(),
            name: "Charlie".into(),
            email: "charlie@example.com".into(),
            age: 17,
            active: false,
        },
        User {
            id: "user:4".into(),
            name: "Diana".into(),
            email: "diana@example.com".into(),
            age: 45,
            active: true,
        },
        User {
            id: "user:5".into(),
            name: "Eve".into(),
            email: "eve@example.com".into(),
            age: 22,
            active: false,
        },
    ];

    for user in &users {
        user.save(&db).await?;
    }
    println!("✅ Created {} users\n", users.len());

    // Query 1: Find all users
    println!("Query 1: Find all users");
    let all_users = User::find_all(&db).await?;
    println!("✅ Found {} users\n", all_users.len());

    // Query 2: Filter by age >= 18
    println!("Query 2: Find users aged 18 or older");
    let adults = User::query()
        .filter("age", Query::gte(18))
        .exec(&db)
        .await?;
    println!("✅ Found {} adult users:", adults.len());
    for user in &adults {
        println!("   - {} (age {})", user.name, user.age);
    }
    println!();

    // Query 3: Filter by active status
    println!("Query 3: Find active users");
    let active_users = User::query()
        .filter("active", Query::eq(true))
        .exec(&db)
        .await?;
    println!("✅ Found {} active users:", active_users.len());
    for user in &active_users {
        println!("   - {}", user.name);
    }
    println!();

    // Query 4: Multiple filters (active AND age >= 18)
    println!("Query 4: Find active adults (active=true AND age>=18)");
    let active_adults = User::query()
        .filter("active", Query::eq(true))
        .filter("age", Query::gte(18))
        .exec(&db)
        .await?;
    println!("✅ Found {} active adult users:", active_adults.len());
    for user in &active_adults {
        println!("   - {} (age {})", user.name, user.age);
    }
    println!();

    // Query 5: Filter with contains
    println!("Query 5: Find users with 'a' in email");
    let email_filter = User::query()
        .filter("email", Query::contains("a"))
        .exec(&db)
        .await?;
    println!("✅ Found {} users:", email_filter.len());
    for user in &email_filter {
        println!("   - {} ({})", user.name, user.email);
    }
    println!();

    // Query 6: Sort by name (ascending)
    println!("Query 6: All users sorted by name (A-Z)");
    let sorted_users = User::query()
        .sort_by("name", SortOrder::Asc)
        .exec(&db)
        .await?;
    println!("✅ Users in alphabetical order:");
    for user in &sorted_users {
        println!("   - {}", user.name);
    }
    println!();

    // Query 7: Sort by age (descending)
    println!("Query 7: All users sorted by age (oldest first)");
    let sorted_by_age = User::query()
        .sort_by("age", SortOrder::Desc)
        .exec(&db)
        .await?;
    println!("✅ Users by age (descending):");
    for user in &sorted_by_age {
        println!("   - {} (age {})", user.name, user.age);
    }
    println!();

    // Query 8: Pagination (limit + skip)
    println!("Query 8: Pagination - Page 2 (skip 2, limit 2)");
    let page2 = User::query()
        .sort_by("name", SortOrder::Asc)
        .skip(2)
        .limit(2)
        .exec(&db)
        .await?;
    println!("✅ Page 2 users:");
    for user in &page2 {
        println!("   - {}", user.name);
    }
    println!();

    // Query 9: Complex query
    println!("Query 9: Complex - Active adults, sorted by age, limit 3");
    let complex = User::query()
        .filter("active", Query::eq(true))
        .filter("age", Query::gte(18))
        .sort_by("age", SortOrder::Asc)
        .limit(3)
        .exec(&db)
        .await?;
    println!("✅ Found {} users:", complex.len());
    for user in &complex {
        println!(
            "   - {} (age {}, active={})",
            user.name, user.age, user.active
        );
    }
    println!();

    // Query 10: Count with filter
    println!("Query 10: Count active users");
    let active_count = User::query()
        .filter("active", Query::eq(true))
        .count(&db)
        .await?;
    println!("✅ Active users count: {}\n", active_count);

    // Query 11: Total count
    println!("Query 11: Total user count");
    let total_count = User::count(&db).await?;
    println!("✅ Total users: {}\n", total_count);

    // Cleanup
    println!("Cleaning up...");
    for user in &users {
        user.delete(&db).await?;
    }
    println!("✅ Cleanup complete\n");

    println!("🎉 Advanced queries example completed!");
    Ok(())
}
