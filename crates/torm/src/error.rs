//! TORM Error types

use thiserror::Error;

/// TORM Result type
pub type Result<T> = std::result::Result<T, Error>;

/// TORM Error
#[derive(Error, Debug)]
pub enum Error {
    /// Redis error
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Model not found
    #[error("Model not found: {0}")]
    NotFound(String),

    /// Validation error
    #[error("Validation error: {0}")]
    Validation(String),

    /// Connection error
    #[error("Connection error: {0}")]
    Connection(String),

    /// Invalid query
    #[error("Invalid query: {0}")]
    InvalidQuery(String),

    /// Generic error
    #[error("{0}")]
    Other(String),
}
