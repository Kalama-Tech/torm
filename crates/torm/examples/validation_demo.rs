//! Validation example with TORM

use serde::{Deserialize, Serialize};
use torm::{Model, Result, TormDb, Validators};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct User {
    id: String,
    name: String,
    email: String,
    age: u32,
    website: Option<String>,
}

// Manually implement Model trait with custom validation
impl torm::Model for User {
    fn collection() -> &'static str {
        "user"
    }

    fn id(&self) -> &str {
        &self.id
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }

    fn validate(&self) -> Result<()> {
        // Validate name length
        Validators::length_range(&self.name, 3, 50)?;

        // Validate email format
        Validators::email(&self.email)?;

        // Validate age range
        Validators::range(&self.age, 13, 120)?;

        // Validate website if provided
        if let Some(website) = &self.website {
            Validators::url(website)?;
        }

        Ok(())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Product {
    id: String,
    name: String,
    price: f64,
    sku: String,
}

// Manually implement Model trait with custom validation
impl torm::Model for Product {
    fn collection() -> &'static str {
        "product"
    }

    fn id(&self) -> &str {
        &self.id
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }

    fn validate(&self) -> Result<()> {
        // Validate name
        Validators::required(&self.name)?;
        Validators::min_length(&self.name, 3)?;

        // Validate price
        Validators::min(&self.price, 0.01)?;

        // Validate SKU format (example: ABC-12345)
        Validators::pattern(&self.sku, r"^[A-Z]{3}-\d{5}$")?;

        Ok(())
    }
}

#[tokio::main]
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    println!("🚀 TORM Validation Example\n");

    // Connect to ToonStore
    println!("Connecting to ToonStore...");
    let db = TormDb::connect("redis://localhost:6379").await?;
    println!("✅ Connected!\n");

    // Test 1: Valid user
    println!("Test 1: Creating valid user...");
    let valid_user = User {
        id: "user:1".into(),
        name: "John Doe".into(),
        email: "john@example.com".into(),
        age: 30,
        website: Some("https://johndoe.com".into()),
    };

    match valid_user.validate() {
        Ok(_) => {
            valid_user.save(&db).await?;
            println!("✅ Valid user saved successfully\n");
        }
        Err(e) => println!("❌ Validation failed: {}\n", e),
    }

    // Test 2: Invalid email
    println!("Test 2: Creating user with invalid email...");
    let invalid_email = User {
        id: "user:2".into(),
        name: "Jane Doe".into(),
        email: "not-an-email".into(),
        age: 25,
        website: None,
    };

    match invalid_email.validate() {
        Ok(_) => println!("❌ Should have failed validation\n"),
        Err(e) => println!("✅ Caught validation error: {}\n", e),
    }

    // Test 3: Invalid name length
    println!("Test 3: Creating user with short name...");
    let short_name = User {
        id: "user:3".into(),
        name: "Jo".into(),
        email: "jo@example.com".into(),
        age: 20,
        website: None,
    };

    match short_name.validate() {
        Ok(_) => println!("❌ Should have failed validation\n"),
        Err(e) => println!("✅ Caught validation error: {}\n", e),
    }

    // Test 4: Invalid age
    println!("Test 4: Creating user with invalid age...");
    let invalid_age = User {
        id: "user:4".into(),
        name: "Child User".into(),
        email: "child@example.com".into(),
        age: 10,
        website: None,
    };

    match invalid_age.validate() {
        Ok(_) => println!("❌ Should have failed validation\n"),
        Err(e) => println!("✅ Caught validation error: {}\n", e),
    }

    // Test 5: Invalid website URL
    println!("Test 5: Creating user with invalid website...");
    let invalid_url = User {
        id: "user:5".into(),
        name: "Bob Smith".into(),
        email: "bob@example.com".into(),
        age: 35,
        website: Some("not-a-url".into()),
    };

    match invalid_url.validate() {
        Ok(_) => println!("❌ Should have failed validation\n"),
        Err(e) => println!("✅ Caught validation error: {}\n", e),
    }

    // Test 6: Valid product
    println!("Test 6: Creating valid product...");
    let valid_product = Product {
        id: "product:1".into(),
        name: "Widget".into(),
        price: 19.99,
        sku: "WID-12345".into(),
    };

    match valid_product.validate() {
        Ok(_) => {
            valid_product.save(&db).await?;
            println!("✅ Valid product saved successfully\n");
        }
        Err(e) => println!("❌ Validation failed: {}\n", e),
    }

    // Test 7: Invalid SKU pattern
    println!("Test 7: Creating product with invalid SKU...");
    let invalid_sku = Product {
        id: "product:2".into(),
        name: "Gadget".into(),
        price: 29.99,
        sku: "INVALID".into(),
    };

    match invalid_sku.validate() {
        Ok(_) => println!("❌ Should have failed validation\n"),
        Err(e) => println!("✅ Caught validation error: {}\n", e),
    }

    // Test 8: Invalid price
    println!("Test 8: Creating product with negative price...");
    let invalid_price = Product {
        id: "product:3".into(),
        name: "Free Item".into(),
        price: -10.0,
        sku: "FRE-99999".into(),
    };

    match invalid_price.validate() {
        Ok(_) => println!("❌ Should have failed validation\n"),
        Err(e) => println!("✅ Caught validation error: {}\n", e),
    }

    // Test 9: save() with validation
    println!("Test 9: Testing automatic validation on save()...");
    let invalid_user = User {
        id: "user:99".into(),
        name: "X".into(), // Too short
        email: "valid@example.com".into(),
        age: 25,
        website: None,
    };

    match invalid_user.save(&db).await {
        Ok(_) => println!("❌ Should have failed to save\n"),
        Err(e) => println!("✅ Save blocked by validation: {}\n", e),
    }

    // Cleanup
    println!("Cleaning up...");
    valid_user.delete(&db).await?;
    valid_product.delete(&db).await?;
    println!("✅ Cleanup complete\n");

    println!("🎉 Validation example completed!");
    Ok(())
}
