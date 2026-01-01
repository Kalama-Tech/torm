//! Model trait and operations

use crate::{Error, Result, TormDb};
use async_trait::async_trait;
use serde::{de::DeserializeOwned, Serialize};

/// Model trait for TORM entities
///
/// This trait is typically derived using the `#[derive(Model)]` proc macro.
///
/// # Example
/// ```rust,no_run
/// use torm::Model;
/// use serde::{Deserialize, Serialize};
///
/// #[derive(Model, Serialize, Deserialize)]
/// struct User {
///     #[id]
///     id: String,
///     name: String,
///     email: String,
/// }
/// ```
#[async_trait]
pub trait Model: Serialize + DeserializeOwned + Send + Sync {
    /// Get the collection name for this model
    fn collection() -> &'static str;

    /// Get the ID of this model instance
    fn id(&self) -> &str;

    /// Set the ID of this model instance
    fn set_id(&mut self, id: String);

    /// Validate this model instance
    ///
    /// Override this method to provide custom validation logic.
    /// By default, returns Ok(()).
    fn validate(&self) -> Result<()> {
        Ok(())
    }

    /// Generate a Redis key for this model
    fn key(&self) -> String {
        format!("{}:{}", Self::collection(), self.id())
    }

    /// Save this model to the database
    ///
    /// Validates the model before saving.
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::{Model, TormDb};
    /// # use serde::{Deserialize, Serialize};
    /// # #[derive(Model, Serialize, Deserialize)]
    /// # struct User { #[id] id: String, name: String }
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let db = TormDb::connect("redis://localhost:6379").await?;
    /// # let user = User { id: "1".into(), name: "John".into() };
    /// user.save(&db).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn save(&self, db: &TormDb) -> Result<()> {
        // Validate before saving
        self.validate()?;

        let key = self.key();
        let value = serde_json::to_string(self)?;

        let mut conn = db.connection().clone();
        redis::cmd("SET")
            .arg(&key)
            .arg(&value)
            .query_async::<()>(&mut conn)
            .await?;

        Ok(())
    }

    /// Find a model by ID
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::{Model, TormDb};
    /// # use serde::{Deserialize, Serialize};
    /// # #[derive(Model, Serialize, Deserialize)]
    /// # struct User { #[id] id: String, name: String }
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let db = TormDb::connect("redis://localhost:6379").await?;
    /// let user = User::find_by_id(&db, "1").await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn find_by_id(db: &TormDb, id: &str) -> Result<Self>
    where
        Self: Sized,
    {
        let key = format!("{}:{}", Self::collection(), id);
        let mut conn = db.connection().clone();

        let value: Option<String> = redis::cmd("GET").arg(&key).query_async(&mut conn).await?;

        match value {
            Some(v) => {
                let model = serde_json::from_str(&v)?;
                Ok(model)
            }
            None => Err(Error::NotFound(format!("{}:{}", Self::collection(), id))),
        }
    }

    /// Delete this model from the database
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::{Model, TormDb};
    /// # use serde::{Deserialize, Serialize};
    /// # #[derive(Model, Serialize, Deserialize)]
    /// # struct User { #[id] id: String, name: String }
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let db = TormDb::connect("redis://localhost:6379").await?;
    /// # let user = User { id: "1".into(), name: "John".into() };
    /// user.delete(&db).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn delete(&self, db: &TormDb) -> Result<()> {
        let key = self.key();
        let mut conn = db.connection().clone();

        redis::cmd("DEL")
            .arg(&key)
            .query_async::<()>(&mut conn)
            .await?;

        Ok(())
    }

    /// Check if a model exists by ID
    async fn exists(db: &TormDb, id: &str) -> Result<bool>
    where
        Self: Sized,
    {
        let key = format!("{}:{}", Self::collection(), id);
        let mut conn = db.connection().clone();

        let exists: bool = redis::cmd("EXISTS")
            .arg(&key)
            .query_async(&mut conn)
            .await?;

        Ok(exists)
    }

    /// Find all models in this collection
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::{Model, TormDb};
    /// # use serde::{Deserialize, Serialize};
    /// # #[derive(Model, Serialize, Deserialize)]
    /// # struct User { #[id] id: String, name: String }
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let db = TormDb::connect("redis://localhost:6379").await?;
    /// let users = User::find_all(&db).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn find_all(db: &TormDb) -> Result<Vec<Self>>
    where
        Self: Sized,
    {
        let pattern = format!("{}:*", Self::collection());
        let mut conn = db.connection().clone();

        // Use KEYS to find all matching keys
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query_async(&mut conn)
            .await?;

        let mut results = Vec::new();
        for key in keys {
            let value: Option<String> = redis::cmd("GET").arg(&key).query_async(&mut conn).await?;

            if let Some(v) = value {
                if let Ok(model) = serde_json::from_str(&v) {
                    results.push(model);
                }
            }
        }

        Ok(results)
    }

    /// Count all models in this collection
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::{Model, TormDb};
    /// # use serde::{Deserialize, Serialize};
    /// # #[derive(Model, Serialize, Deserialize)]
    /// # struct User { #[id] id: String, name: String }
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let db = TormDb::connect("redis://localhost:6379").await?;
    /// let count = User::count(&db).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn count(db: &TormDb) -> Result<usize>
    where
        Self: Sized,
    {
        let pattern = format!("{}:*", Self::collection());
        let mut conn = db.connection().clone();

        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query_async(&mut conn)
            .await?;

        Ok(keys.len())
    }

    /// Create a query builder for this model
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::{Model, TormDb, Query, SortOrder};
    /// # use serde::{Deserialize, Serialize};
    /// # #[derive(Model, Serialize, Deserialize)]
    /// # struct User { #[id] id: String, name: String, age: u32 }
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let db = TormDb::connect("redis://localhost:6379").await?;
    /// let users = User::query()
    ///     .filter("age", Query::gte(18))
    ///     .sort_by("name", SortOrder::Asc)
    ///     .limit(10)
    ///     .exec(&db)
    ///     .await?;
    /// # Ok(())
    /// # }
    /// ```
    fn query() -> crate::query::QueryBuilder<Self>
    where
        Self: Sized,
    {
        crate::query::QueryBuilder::new(Self::collection())
    }
}
