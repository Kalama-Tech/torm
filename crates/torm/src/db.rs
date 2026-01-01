//! Database connection and client

use crate::{Error, Result};
use redis::aio::ConnectionManager;
use redis::Client;

/// TORM database connection
#[derive(Clone)]
pub struct TormDb {
    client: ConnectionManager,
}

impl TormDb {
    /// Connect to ToonStore via Redis protocol
    ///
    /// # Arguments
    /// * `url` - Redis connection URL (e.g., "redis://localhost:6379")
    ///
    /// # Example
    /// ```rust,no_run
    /// # use torm::TormDb;
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// let db = TormDb::connect("redis://localhost:6379").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect(url: &str) -> Result<Self> {
        let client = Client::open(url).map_err(|e| Error::Connection(e.to_string()))?;
        let manager = ConnectionManager::new(client).await?;

        Ok(Self { client: manager })
    }

    /// Get a reference to the Redis connection
    pub fn connection(&self) -> &ConnectionManager {
        &self.client
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires running ToonStore server
    async fn test_connect() {
        let result = TormDb::connect("redis://localhost:6379").await;
        assert!(result.is_ok());
    }
}
