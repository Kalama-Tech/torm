//! Query builder for filtering and sorting

use crate::{Result, TormDb};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::cmp::Ordering;

/// Query operators
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Query {
    /// Equal to
    Eq(serde_json::Value),
    /// Not equal to
    Ne(serde_json::Value),
    /// Greater than
    Gt(serde_json::Value),
    /// Greater than or equal to
    Gte(serde_json::Value),
    /// Less than
    Lt(serde_json::Value),
    /// Less than or equal to
    Lte(serde_json::Value),
    /// Contains (for strings)
    Contains(String),
    /// In array
    In(Vec<serde_json::Value>),
    /// Not in array
    NotIn(Vec<serde_json::Value>),
}

impl Query {
    /// Create an equal query
    pub fn eq<T: Into<serde_json::Value>>(value: T) -> Self {
        Query::Eq(value.into())
    }

    /// Create a not equal query
    pub fn ne<T: Into<serde_json::Value>>(value: T) -> Self {
        Query::Ne(value.into())
    }

    /// Create a greater than query
    pub fn gt<T: Into<serde_json::Value>>(value: T) -> Self {
        Query::Gt(value.into())
    }

    /// Create a greater than or equal query
    pub fn gte<T: Into<serde_json::Value>>(value: T) -> Self {
        Query::Gte(value.into())
    }

    /// Create a less than query
    pub fn lt<T: Into<serde_json::Value>>(value: T) -> Self {
        Query::Lt(value.into())
    }

    /// Create a less than or equal query
    pub fn lte<T: Into<serde_json::Value>>(value: T) -> Self {
        Query::Lte(value.into())
    }

    /// Create a contains query
    pub fn contains(value: impl Into<String>) -> Self {
        Query::Contains(value.into())
    }

    /// Create an in query
    pub fn in_values(values: Vec<serde_json::Value>) -> Self {
        Query::In(values)
    }

    /// Create a not in query
    pub fn not_in(values: Vec<serde_json::Value>) -> Self {
        Query::NotIn(values)
    }
}

/// Sort order
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    /// Ascending
    Asc,
    /// Descending
    Desc,
}

/// Query builder for complex queries
///
/// Performs in-memory filtering by scanning all keys in the collection.
/// For production use with large datasets, consider using indexes or TORM Server.
#[derive(Debug, Clone)]
pub struct QueryBuilder<T> {
    collection: String,
    filters: Vec<(String, Query)>,
    sort: Option<(String, SortOrder)>,
    limit: Option<usize>,
    skip: Option<usize>,
    _phantom: std::marker::PhantomData<T>,
}

impl<T> QueryBuilder<T>
where
    T: Serialize + DeserializeOwned,
{
    /// Create a new query builder for a collection
    pub fn new(collection: impl Into<String>) -> Self {
        Self {
            collection: collection.into(),
            filters: Vec::new(),
            sort: None,
            limit: None,
            skip: None,
            _phantom: std::marker::PhantomData,
        }
    }

    /// Add a filter condition
    pub fn filter(mut self, field: impl Into<String>, query: Query) -> Self {
        self.filters.push((field.into(), query));
        self
    }

    /// Set sort order by field
    pub fn sort_by(mut self, field: impl Into<String>, order: SortOrder) -> Self {
        self.sort = Some((field.into(), order));
        self
    }

    /// Set result limit
    pub fn limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Set result skip/offset
    pub fn skip(mut self, skip: usize) -> Self {
        self.skip = Some(skip);
        self
    }

    /// Execute the query
    ///
    /// # Note
    /// This performs in-memory filtering by fetching all documents
    /// and filtering them locally. For large datasets, consider indexes.
    pub async fn exec(&self, db: &TormDb) -> Result<Vec<T>> {
        let pattern = format!("{}:*", self.collection);
        let mut conn = db.connection().clone();

        // Get all keys in collection
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query_async(&mut conn)
            .await?;

        // Fetch all documents
        let mut documents = Vec::new();
        for key in keys {
            let value: Option<String> = redis::cmd("GET").arg(&key).query_async(&mut conn).await?;

            if let Some(v) = value {
                if let Ok(doc) = serde_json::from_str::<T>(&v) {
                    documents.push((doc, serde_json::from_str::<serde_json::Value>(&v)?));
                }
            }
        }

        // Apply filters
        documents.retain(|(_, json_doc)| self.matches_filters(json_doc));

        // Apply sorting
        if let Some((field, order)) = &self.sort {
            documents.sort_by(|(_, a), (_, b)| {
                let a_val = a.get(field);
                let b_val = b.get(field);
                let cmp = compare_json_values(a_val, b_val);
                match order {
                    SortOrder::Asc => cmp,
                    SortOrder::Desc => cmp.reverse(),
                }
            });
        }

        // Extract just the documents (not JSON values)
        let mut results: Vec<T> = documents.into_iter().map(|(doc, _)| doc).collect();

        // Apply skip
        if let Some(skip) = self.skip {
            results = results.into_iter().skip(skip).collect();
        }

        // Apply limit
        if let Some(limit) = self.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    /// Count documents matching the query
    pub async fn count(&self, db: &TormDb) -> Result<usize> {
        let pattern = format!("{}:*", self.collection);
        let mut conn = db.connection().clone();

        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query_async(&mut conn)
            .await?;

        if self.filters.is_empty() {
            return Ok(keys.len());
        }

        // Need to filter, so fetch and count
        let mut count = 0;
        for key in keys {
            let value: Option<String> = redis::cmd("GET").arg(&key).query_async(&mut conn).await?;

            if let Some(v) = value {
                if let Ok(json_doc) = serde_json::from_str::<serde_json::Value>(&v) {
                    if self.matches_filters(&json_doc) {
                        count += 1;
                    }
                }
            }
        }

        Ok(count)
    }

    /// Check if a document matches all filters
    fn matches_filters(&self, doc: &serde_json::Value) -> bool {
        for (field, query) in &self.filters {
            if !self.matches_filter(doc, field, query) {
                return false;
            }
        }
        true
    }

    /// Check if a document matches a single filter
    fn matches_filter(&self, doc: &serde_json::Value, field: &str, query: &Query) -> bool {
        let value = doc.get(field);

        match query {
            Query::Eq(expected) => value == Some(expected),
            Query::Ne(expected) => value != Some(expected),
            Query::Gt(expected) => {
                if let (Some(v), Some(e)) = (
                    value,
                    expected
                        .as_f64()
                        .or_else(|| expected.as_i64().map(|i| i as f64)),
                ) {
                    if let Some(vf) = v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)) {
                        return vf > e;
                    }
                }
                false
            }
            Query::Gte(expected) => {
                if let (Some(v), Some(e)) = (
                    value,
                    expected
                        .as_f64()
                        .or_else(|| expected.as_i64().map(|i| i as f64)),
                ) {
                    if let Some(vf) = v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)) {
                        return vf >= e;
                    }
                }
                false
            }
            Query::Lt(expected) => {
                if let (Some(v), Some(e)) = (
                    value,
                    expected
                        .as_f64()
                        .or_else(|| expected.as_i64().map(|i| i as f64)),
                ) {
                    if let Some(vf) = v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)) {
                        return vf < e;
                    }
                }
                false
            }
            Query::Lte(expected) => {
                if let (Some(v), Some(e)) = (
                    value,
                    expected
                        .as_f64()
                        .or_else(|| expected.as_i64().map(|i| i as f64)),
                ) {
                    if let Some(vf) = v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)) {
                        return vf <= e;
                    }
                }
                false
            }
            Query::Contains(substr) => {
                if let Some(v) = value.and_then(|v| v.as_str()) {
                    return v.contains(substr);
                }
                false
            }
            Query::In(values) => {
                if let Some(v) = value {
                    return values.contains(v);
                }
                false
            }
            Query::NotIn(values) => {
                if let Some(v) = value {
                    return !values.contains(v);
                }
                true
            }
        }
    }
}

/// Compare two JSON values for sorting
fn compare_json_values(a: Option<&serde_json::Value>, b: Option<&serde_json::Value>) -> Ordering {
    match (a, b) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Less,
        (Some(_), None) => Ordering::Greater,
        (Some(a), Some(b)) => {
            // Try numeric comparison first
            if let (Some(an), Some(bn)) = (
                a.as_f64().or_else(|| a.as_i64().map(|i| i as f64)),
                b.as_f64().or_else(|| b.as_i64().map(|i| i as f64)),
            ) {
                return an.partial_cmp(&bn).unwrap_or(Ordering::Equal);
            }

            // Try string comparison
            if let (Some(as_), Some(bs)) = (a.as_str(), b.as_str()) {
                return as_.cmp(bs);
            }

            // Try boolean comparison
            if let (Some(ab), Some(bb)) = (a.as_bool(), b.as_bool()) {
                return ab.cmp(&bb);
            }

            Ordering::Equal
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_builder() {
        let query = QueryBuilder::<serde_json::Value>::new("users")
            .filter("age", Query::gte(18))
            .filter("active", Query::eq(true))
            .sort_by("created_at", SortOrder::Desc)
            .limit(10);

        assert_eq!(query.filters.len(), 2);
        assert!(query.sort.is_some());
        assert_eq!(query.limit, Some(10));
    }

    #[test]
    fn test_query_operators() {
        let eq = Query::eq(42);
        let gte = Query::gte(18);
        let contains = Query::contains("test");

        // Just verify they compile
        assert!(matches!(eq, Query::Eq(_)));
        assert!(matches!(gte, Query::Gte(_)));
        assert!(matches!(contains, Query::Contains(_)));
    }
}
