//! Validation module for TORM

use crate::{Error, Result};
use regex::Regex;
use std::sync::OnceLock;

/// Validation error details
#[derive(Debug, Clone)]
pub struct ValidationError {
    /// Field name that failed validation
    pub field: String,
    /// Error message
    pub message: String,
}

impl ValidationError {
    /// Create a new validation error
    pub fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            message: message.into(),
        }
    }
}

/// Collection of validation errors
#[derive(Debug, Clone)]
pub struct ValidationErrors {
    errors: Vec<ValidationError>,
}

impl ValidationErrors {
    /// Create a new empty validation errors collection
    pub fn new() -> Self {
        Self { errors: Vec::new() }
    }

    /// Add a validation error
    pub fn add(&mut self, field: impl Into<String>, message: impl Into<String>) {
        self.errors.push(ValidationError::new(field, message));
    }

    /// Check if there are any errors
    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }

    /// Get all errors
    pub fn errors(&self) -> &[ValidationError] {
        &self.errors
    }

    /// Convert to Result
    pub fn into_result(self) -> Result<()> {
        if self.is_empty() {
            Ok(())
        } else {
            let messages: Vec<String> = self
                .errors
                .iter()
                .map(|e| format!("{}: {}", e.field, e.message))
                .collect();
            Err(Error::Validation(messages.join(", ")))
        }
    }
}

impl Default for ValidationErrors {
    fn default() -> Self {
        Self::new()
    }
}

/// Validator trait for custom validators
pub trait Validator<T> {
    /// Validate a value
    fn validate(&self, value: &T) -> Result<()>;
}

/// Built-in validators
pub struct Validators;

impl Validators {
    /// Validate minimum numeric value
    pub fn min<T: PartialOrd>(value: &T, min: T) -> Result<()> {
        if value >= &min {
            Ok(())
        } else {
            Err(Error::Validation(format!(
                "Value must be >= {}",
                std::any::type_name::<T>()
            )))
        }
    }

    /// Validate maximum numeric value
    pub fn max<T: PartialOrd>(value: &T, max: T) -> Result<()> {
        if value <= &max {
            Ok(())
        } else {
            Err(Error::Validation(format!(
                "Value must be <= {}",
                std::any::type_name::<T>()
            )))
        }
    }

    /// Validate minimum string length
    pub fn min_length(value: &str, min: usize) -> Result<()> {
        if value.len() >= min {
            Ok(())
        } else {
            Err(Error::Validation(format!(
                "String length must be >= {} characters",
                min
            )))
        }
    }

    /// Validate maximum string length
    pub fn max_length(value: &str, max: usize) -> Result<()> {
        if value.len() <= max {
            Ok(())
        } else {
            Err(Error::Validation(format!(
                "String length must be <= {} characters",
                max
            )))
        }
    }

    /// Validate email format
    pub fn email(value: &str) -> Result<()> {
        static EMAIL_REGEX: OnceLock<Regex> = OnceLock::new();
        let regex = EMAIL_REGEX.get_or_init(|| {
            Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap()
        });

        if regex.is_match(value) {
            Ok(())
        } else {
            Err(Error::Validation("Invalid email format".to_string()))
        }
    }

    /// Validate URL format
    pub fn url(value: &str) -> Result<()> {
        if value.starts_with("http://") || value.starts_with("https://") {
            Ok(())
        } else {
            Err(Error::Validation(
                "Invalid URL format (must start with http:// or https://)".to_string(),
            ))
        }
    }

    /// Validate that string is not empty
    pub fn required(value: &str) -> Result<()> {
        if !value.is_empty() {
            Ok(())
        } else {
            Err(Error::Validation("Field is required".to_string()))
        }
    }

    /// Validate that Option is Some
    pub fn required_option<T>(value: &Option<T>) -> Result<()> {
        if value.is_some() {
            Ok(())
        } else {
            Err(Error::Validation("Field is required".to_string()))
        }
    }

    /// Validate string matches regex pattern
    pub fn pattern(value: &str, pattern: &str) -> Result<()> {
        let regex = Regex::new(pattern)
            .map_err(|e| Error::Validation(format!("Invalid regex pattern: {}", e)))?;

        if regex.is_match(value) {
            Ok(())
        } else {
            Err(Error::Validation(format!(
                "Value does not match pattern: {}",
                pattern
            )))
        }
    }

    /// Validate numeric value is in range
    pub fn range<T: PartialOrd>(value: &T, min: T, max: T) -> Result<()> {
        Self::min(value, min)?;
        Self::max(value, max)?;
        Ok(())
    }

    /// Validate string length is in range
    pub fn length_range(value: &str, min: usize, max: usize) -> Result<()> {
        Self::min_length(value, min)?;
        Self::max_length(value, max)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_min_validator() {
        assert!(Validators::min(&10, 5).is_ok());
        assert!(Validators::min(&3, 5).is_err());
    }

    #[test]
    fn test_max_validator() {
        assert!(Validators::max(&5, 10).is_ok());
        assert!(Validators::max(&15, 10).is_err());
    }

    #[test]
    fn test_min_length() {
        assert!(Validators::min_length("hello", 3).is_ok());
        assert!(Validators::min_length("hi", 3).is_err());
    }

    #[test]
    fn test_max_length() {
        assert!(Validators::max_length("hello", 10).is_ok());
        assert!(Validators::max_length("hello world", 5).is_err());
    }

    #[test]
    fn test_email() {
        assert!(Validators::email("test@example.com").is_ok());
        assert!(Validators::email("invalid-email").is_err());
        assert!(Validators::email("@example.com").is_err());
    }

    #[test]
    fn test_url() {
        assert!(Validators::url("http://example.com").is_ok());
        assert!(Validators::url("https://example.com").is_ok());
        assert!(Validators::url("ftp://example.com").is_err());
        assert!(Validators::url("example.com").is_err());
    }

    #[test]
    fn test_required() {
        assert!(Validators::required("hello").is_ok());
        assert!(Validators::required("").is_err());
    }

    #[test]
    fn test_range() {
        assert!(Validators::range(&5, 1, 10).is_ok());
        assert!(Validators::range(&0, 1, 10).is_err());
        assert!(Validators::range(&11, 1, 10).is_err());
    }

    #[test]
    fn test_validation_errors() {
        let mut errors = ValidationErrors::new();
        assert!(errors.is_empty());

        errors.add("name", "Name is required");
        errors.add("age", "Age must be >= 18");
        assert!(!errors.is_empty());
        assert_eq!(errors.errors().len(), 2);

        let result = errors.into_result();
        assert!(result.is_err());
    }
}
