//! TORM - ToonStore ORM
//!
//! Mongoose-style ORM for ToonStore with type-safe models,
//! validation, and relationships.
//!
//! # Example
//!
//! ```rust,no_run
//! use torm::{Model, TormDb};
//! use serde::{Deserialize, Serialize};
//!
//! #[derive(Model, Serialize, Deserialize)]
//! struct User {
//!     #[id]
//!     id: String,
//!     name: String,
//!     email: String,
//! }
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let db = TormDb::connect("redis://localhost:6379").await?;
//!     
//!     let user = User {
//!         id: "user:1".into(),
//!         name: "John Doe".into(),
//!         email: "john@example.com".into(),
//!     };
//!     
//!     user.save(&db).await?;
//!     Ok(())
//! }
//! ```

#![warn(missing_docs)]

mod db;
mod error;
mod migration;
mod model;
mod query;
mod validation;

pub use db::TormDb;
pub use error::{Error, Result};
pub use migration::{Migration, MigrationFile, MigrationManager, MigrationStatus};
pub use model::Model;
pub use query::{Query, QueryBuilder, SortOrder};
pub use validation::{ValidationError, ValidationErrors, Validator, Validators};

// Re-export derive macro
pub use torm_derive::Model;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
