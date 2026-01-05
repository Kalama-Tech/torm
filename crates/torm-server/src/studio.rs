use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, Json},
    routing::{delete, get, post, put},
    Router,
};
use redis::aio::ConnectionManager;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

/// Studio server state
#[derive(Clone)]
pub struct StudioState {
    pub redis_client: Arc<ConnectionManager>,
}

/// Create studio router
pub fn studio_router<S>(state: StudioState) -> Router<S> {
    Router::new()
        .route("/", get(studio_ui))
        .route("/api/keys", get(list_keys))
        .route("/api/keys/:key", get(get_key))
        .route("/api/keys/:key", put(update_key))
        .route("/api/keys/:key", delete(delete_key))
        .route("/api/keys", post(create_key))
        .route("/api/stats", get(get_stats))
        .route("/api/collections", get(list_collections))
        .route("/api/collections/:collection", get(get_collection_data))
        .with_state(state)
}

/// Serve studio UI
async fn studio_ui() -> Html<&'static str> {
    Html(include_str!("studio.html"))
}

#[derive(Deserialize)]
struct ListKeysQuery {
    #[serde(default)]
    pattern: String,
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    100
}

/// List all keys
async fn list_keys(
    State(state): State<StudioState>,
    Query(query): Query<ListKeysQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();
    let pattern = if query.pattern.is_empty() {
        "*".to_string()
    } else {
        query.pattern
    };

    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(&pattern)
        .query_async(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let limited_keys: Vec<String> = keys.into_iter().take(query.limit).collect();

    Ok(Json(json!({
        "keys": limited_keys,
        "count": limited_keys.len()
    })))
}

/// Get key value
async fn get_key(
    State(state): State<StudioState>,
    Path(key): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    let value: String = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut conn)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;

    // Try to parse as JSON
    let parsed_value = serde_json::from_str::<Value>(&value).unwrap_or(json!(value));

    Ok(Json(json!({
        "key": key,
        "value": parsed_value,
        "raw": value
    })))
}

#[derive(Deserialize)]
struct UpdateKeyRequest {
    value: Value,
}

/// Update key
async fn update_key(
    State(state): State<StudioState>,
    Path(key): Path<String>,
    Json(payload): Json<UpdateKeyRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    let value_str = serde_json::to_string(&payload.value)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    redis::cmd("SET")
        .arg(&key)
        .arg(value_str)
        .query_async::<()>(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "success": true,
        "key": key
    })))
}

/// Delete key
async fn delete_key(
    State(state): State<StudioState>,
    Path(key): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    redis::cmd("DEL")
        .arg(&key)
        .query_async::<()>(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "success": true,
        "key": key
    })))
}

#[derive(Deserialize)]
struct CreateKeyRequest {
    key: String,
    value: Value,
}

/// Create new key
async fn create_key(
    State(state): State<StudioState>,
    Json(payload): Json<CreateKeyRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    let value_str = serde_json::to_string(&payload.value)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    redis::cmd("SET")
        .arg(&payload.key)
        .arg(value_str)
        .query_async::<()>(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "success": true,
        "key": payload.key
    })))
}

/// Get database stats
async fn get_stats(State(state): State<StudioState>) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    let dbsize: i64 = redis::cmd("DBSIZE")
        .query_async(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let info: String = redis::cmd("INFO")
        .query_async(&mut conn)
        .await
        .unwrap_or_default();

    Ok(Json(json!({
        "total_keys": dbsize,
        "info": info
    })))
}

/// List all collections (unique prefixes)
async fn list_collections(
    State(state): State<StudioState>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    let keys: Vec<String> = redis::cmd("KEYS")
        .arg("*")
        .query_async(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut collections = std::collections::HashSet::new();
    for key in keys {
        if let Some(prefix) = key.split(':').next() {
            collections.insert(prefix.to_string());
        }
    }

    let mut collections_vec: Vec<String> = collections.into_iter().collect();
    collections_vec.sort();

    Ok(Json(json!({
        "collections": collections_vec
    })))
}

/// Get all data for a collection
async fn get_collection_data(
    State(state): State<StudioState>,
    Path(collection): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut conn = state.redis_client.as_ref().clone();

    let pattern = format!("{}:*", collection);
    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(&pattern)
        .query_async(&mut conn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut data = Vec::new();
    for key in &keys {
        if let Ok(value) = redis::cmd("GET")
            .arg(key)
            .query_async::<String>(&mut conn)
            .await
        {
            let parsed_value = serde_json::from_str::<Value>(&value).unwrap_or(json!(value));
            data.push(json!({
                "key": key,
                "value": parsed_value
            }));
        }
    }

    Ok(Json(json!({
        "collection": collection,
        "count": data.len(),
        "data": data
    })))
}
