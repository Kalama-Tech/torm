//! TORM REST API Server
//!
//! Provides HTTP API for multi-language TORM support

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use torm::TormDb;
use tower_http::cors::CorsLayer;
use tracing::{error, info, Level};
use tracing_subscriber;

#[derive(Clone)]
struct AppState {
    db: TormDb,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    info!("Starting TORM Server v{}", env!("CARGO_PKG_VERSION"));

    // Connect to ToonStore
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    info!("Connecting to ToonStore at {}", redis_url);

    let db = match TormDb::connect(&redis_url).await {
        Ok(db) => {
            info!("✅ Connected to ToonStore");
            db
        }
        Err(e) => {
            error!("❌ Failed to connect to ToonStore: {}", e);
            return Err(e.into());
        }
    };

    let state = AppState { db };

    // Build router
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/api/:collection", post(create_document))
        .route("/api/:collection", get(find_all_documents))
        .route("/api/:collection/:id", get(find_by_id))
        .route("/api/:collection/:id", axum::routing::put(update_document))
        .route(
            "/api/:collection/:id",
            axum::routing::delete(delete_document),
        )
        .route("/api/:collection/query", post(query_documents))
        .route("/api/:collection/count", get(count_documents))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(state));

    // Bind to address
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    info!("🚀 TORM Server listening on http://{}", addr);
    info!("📚 API Documentation: http://{}/", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// Root endpoint
async fn root() -> impl IntoResponse {
    Json(serde_json::json!({
        "name": "TORM Server",
        "version": env!("CARGO_PKG_VERSION"),
        "status": "running",
        "description": "ToonStore ORM HTTP API",
        "endpoints": {
            "health": "GET /health",
            "create": "POST /api/{collection}",
            "find_all": "GET /api/{collection}",
            "find_by_id": "GET /api/{collection}/{id}",
            "update": "PUT /api/{collection}/{id}",
            "delete": "DELETE /api/{collection}/{id}",
            "query": "POST /api/{collection}/query",
            "count": "GET /api/{collection}/count"
        }
    }))
}

// Health check
async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Try a simple Redis operation to verify connection
    match redis::cmd("PING")
        .query_async::<String>(&mut state.db.connection().clone())
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "ok",
                "database": "connected"
            })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "status": "error",
                "database": "disconnected",
                "error": e.to_string()
            })),
        ),
    }
}

// Create document
#[derive(Deserialize)]
struct CreateRequest {
    data: serde_json::Value,
}

#[derive(Serialize)]
struct CreateResponse {
    success: bool,
    id: String,
    data: serde_json::Value,
}

async fn create_document(
    State(state): State<Arc<AppState>>,
    Path(collection): Path<String>,
    Json(req): Json<CreateRequest>,
) -> impl IntoResponse {
    info!("Creating document in collection: {}", collection);

    // Extract or generate ID
    let id = if let Some(id_value) = req.data.get("id") {
        id_value.as_str().unwrap_or_default().to_string()
    } else {
        format!("{}:{}", collection, uuid::Uuid::new_v4())
    };

    let key = format!("{}:{}", collection, id);

    match redis::cmd("SET")
        .arg(&key)
        .arg(serde_json::to_string(&req.data).unwrap())
        .query_async::<()>(&mut state.db.connection().clone())
        .await
    {
        Ok(_) => (
            StatusCode::CREATED,
            Json(CreateResponse {
                success: true,
                id,
                data: req.data,
            }),
        )
            .into_response(),
        Err(e) => {
            error!("Failed to create document: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "success": false,
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

// Find all documents
async fn find_all_documents(
    State(state): State<Arc<AppState>>,
    Path(collection): Path<String>,
) -> impl IntoResponse {
    info!("Finding all documents in collection: {}", collection);

    let pattern = format!("{}:*", collection);

    match redis::cmd("KEYS")
        .arg(&pattern)
        .query_async::<Vec<String>>(&mut state.db.connection().clone())
        .await
    {
        Ok(keys) => {
            let mut documents = Vec::new();

            for key in keys {
                if let Ok(value) = redis::cmd("GET")
                    .arg(&key)
                    .query_async::<String>(&mut state.db.connection().clone())
                    .await
                {
                    if let Ok(doc) = serde_json::from_str::<serde_json::Value>(&value) {
                        documents.push(doc);
                    }
                }
            }

            Json(serde_json::json!({
                "collection": collection,
                "count": documents.len(),
                "documents": documents
            }))
        }
        Err(e) => {
            error!("Failed to find documents: {}", e);
            Json(serde_json::json!({
                "error": e.to_string(),
                "documents": []
            }))
        }
    }
}

// Find by ID
async fn find_by_id(
    State(state): State<Arc<AppState>>,
    Path((collection, id)): Path<(String, String)>,
) -> impl IntoResponse {
    info!("Finding document {}:{}", collection, id);

    let key = format!("{}:{}", collection, id);

    match redis::cmd("GET")
        .arg(&key)
        .query_async::<Option<String>>(&mut state.db.connection().clone())
        .await
    {
        Ok(Some(value)) => match serde_json::from_str::<serde_json::Value>(&value) {
            Ok(doc) => (StatusCode::OK, Json(doc)),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": format!("Failed to parse document: {}", e)
                })),
            ),
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Document not found"
            })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e.to_string()
            })),
        ),
    }
}

// Update document
#[derive(Deserialize)]
struct UpdateRequest {
    data: serde_json::Value,
}

async fn update_document(
    State(state): State<Arc<AppState>>,
    Path((collection, id)): Path<(String, String)>,
    Json(req): Json<UpdateRequest>,
) -> impl IntoResponse {
    info!("Updating document {}:{}", collection, id);

    let key = format!("{}:{}", collection, id);

    // Check if exists
    match redis::cmd("EXISTS")
        .arg(&key)
        .query_async::<i32>(&mut state.db.connection().clone())
        .await
    {
        Ok(1) => {
            // Document exists, update it
            match redis::cmd("SET")
                .arg(&key)
                .arg(serde_json::to_string(&req.data).unwrap())
                .query_async::<()>(&mut state.db.connection().clone())
                .await
            {
                Ok(_) => Json(serde_json::json!({
                    "success": true,
                    "id": id,
                    "data": req.data
                })),
                Err(e) => Json(serde_json::json!({
                    "success": false,
                    "error": e.to_string()
                })),
            }
        }
        Ok(_) => Json(serde_json::json!({
            "success": false,
            "error": "Document not found"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}

// Delete document
async fn delete_document(
    State(state): State<Arc<AppState>>,
    Path((collection, id)): Path<(String, String)>,
) -> impl IntoResponse {
    info!("Deleting document {}:{}", collection, id);

    let key = format!("{}:{}", collection, id);

    match redis::cmd("DEL")
        .arg(&key)
        .query_async::<i32>(&mut state.db.connection().clone())
        .await
    {
        Ok(1) => Json(serde_json::json!({
            "success": true,
            "deleted": true
        })),
        Ok(_) => Json(serde_json::json!({
            "success": false,
            "error": "Document not found"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}

// Query documents
#[derive(Deserialize)]
struct QueryRequest {
    filters: Option<serde_json::Value>,
    sort: Option<serde_json::Value>,
    limit: Option<usize>,
    skip: Option<usize>,
}

async fn query_documents(
    State(state): State<Arc<AppState>>,
    Path(collection): Path<String>,
    Json(query): Json<QueryRequest>,
) -> impl IntoResponse {
    info!("Querying documents in collection: {}", collection);

    // For now, just return all and let client filter
    // TODO: Implement server-side filtering
    let pattern = format!("{}:*", collection);

    match redis::cmd("KEYS")
        .arg(&pattern)
        .query_async::<Vec<String>>(&mut state.db.connection().clone())
        .await
    {
        Ok(keys) => {
            let mut documents = Vec::new();

            for key in keys {
                if let Ok(value) = redis::cmd("GET")
                    .arg(&key)
                    .query_async::<String>(&mut state.db.connection().clone())
                    .await
                {
                    if let Ok(doc) = serde_json::from_str::<serde_json::Value>(&value) {
                        documents.push(doc);
                    }
                }
            }

            // Apply skip/limit
            let skip = query.skip.unwrap_or(0);
            let limit = query.limit.unwrap_or(documents.len());
            let documents: Vec<_> = documents.into_iter().skip(skip).take(limit).collect();

            Json(serde_json::json!({
                "collection": collection,
                "count": documents.len(),
                "documents": documents
            }))
        }
        Err(e) => Json(serde_json::json!({
            "error": e.to_string(),
            "documents": []
        })),
    }
}

// Count documents
async fn count_documents(
    State(state): State<Arc<AppState>>,
    Path(collection): Path<String>,
) -> impl IntoResponse {
    info!("Counting documents in collection: {}", collection);

    let pattern = format!("{}:*", collection);

    match redis::cmd("KEYS")
        .arg(&pattern)
        .query_async::<Vec<String>>(&mut state.db.connection().clone())
        .await
    {
        Ok(keys) => Json(serde_json::json!({
            "collection": collection,
            "count": keys.len()
        })),
        Err(e) => Json(serde_json::json!({
            "error": e.to_string(),
            "count": 0
        })),
    }
}
