use crate::error::{Error, Result};
use crate::TormDb;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Migration metadata stored in ToonStore
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub id: String,
    pub name: String,
    pub applied_at: DateTime<Utc>,
    pub checksum: String,
}

/// Migration file definition
#[derive(Debug, Clone)]
pub struct MigrationFile {
    pub id: String,
    pub name: String,
    pub up: Box<dyn Fn(&TormDb) -> Result<()> + Send + Sync>,
    pub down: Box<dyn Fn(&TormDb) -> Result<()> + Send + Sync>,
}

/// Migration manager
pub struct MigrationManager {
    migrations: Vec<MigrationFile>,
}

impl MigrationManager {
    pub fn new() -> Self {
        Self {
            migrations: Vec::new(),
        }
    }

    /// Register a migration
    pub fn add_migration(
        &mut self,
        id: impl Into<String>,
        name: impl Into<String>,
        up: impl Fn(&TormDb) -> Result<()> + Send + Sync + 'static,
        down: impl Fn(&TormDb) -> Result<()> + Send + Sync + 'static,
    ) {
        self.migrations.push(MigrationFile {
            id: id.into(),
            name: name.into(),
            up: Box::new(up),
            down: Box::new(down),
        });
    }

    /// Run all pending migrations
    pub async fn migrate(&self, db: &TormDb) -> Result<Vec<String>> {
        let applied = self.get_applied_migrations(db).await?;
        let mut newly_applied = Vec::new();

        for migration in &self.migrations {
            if !applied.contains_key(&migration.id) {
                // Run migration
                (migration.up)(db)?;

                // Record migration
                let record = Migration {
                    id: migration.id.clone(),
                    name: migration.name.clone(),
                    applied_at: Utc::now(),
                    checksum: self.calculate_checksum(&migration.id),
                };

                self.save_migration(db, &record).await?;
                newly_applied.push(migration.name.clone());
            }
        }

        Ok(newly_applied)
    }

    /// Rollback last N migrations
    pub async fn rollback(&self, db: &TormDb, steps: usize) -> Result<Vec<String>> {
        let applied = self.get_applied_migrations(db).await?;
        let mut rolled_back = Vec::new();

        // Sort by applied_at descending
        let mut migrations_vec: Vec<_> = applied.into_iter().collect();
        migrations_vec.sort_by(|a, b| b.1.applied_at.cmp(&a.1.applied_at));

        for (migration_id, record) in migrations_vec.iter().take(steps) {
            // Find migration file
            if let Some(migration) = self.migrations.iter().find(|m| &m.id == migration_id) {
                // Run down migration
                (migration.down)(db)?;

                // Remove migration record
                self.remove_migration(db, migration_id).await?;
                rolled_back.push(record.name.clone());
            }
        }

        Ok(rolled_back)
    }

    /// Get list of applied migrations
    pub async fn status(&self, db: &TormDb) -> Result<HashMap<String, MigrationStatus>> {
        let applied = self.get_applied_migrations(db).await?;
        let mut status = HashMap::new();

        for migration in &self.migrations {
            if let Some(record) = applied.get(&migration.id) {
                status.insert(
                    migration.id.clone(),
                    MigrationStatus::Applied {
                        name: migration.name.clone(),
                        applied_at: record.applied_at,
                    },
                );
            } else {
                status.insert(
                    migration.id.clone(),
                    MigrationStatus::Pending {
                        name: migration.name.clone(),
                    },
                );
            }
        }

        Ok(status)
    }

    /// Get applied migrations from database
    async fn get_applied_migrations(&self, db: &TormDb) -> Result<HashMap<String, Migration>> {
        let key = "torm:migrations";
        match redis::cmd("GET")
            .arg(key)
            .query_async::<String>(&mut db.connection().clone())
            .await
        {
            Ok(data) => {
                let migrations: HashMap<String, Migration> =
                    serde_json::from_str(&data).map_err(|e| Error::Serialization(e.to_string()))?;
                Ok(migrations)
            }
            Err(_) => Ok(HashMap::new()),
        }
    }

    /// Save migration record
    async fn save_migration(&self, db: &TormDb, migration: &Migration) -> Result<()> {
        let key = "torm:migrations";
        let mut migrations = self.get_applied_migrations(db).await?;
        migrations.insert(migration.id.clone(), migration.clone());

        let data =
            serde_json::to_string(&migrations).map_err(|e| Error::Serialization(e.to_string()))?;

        redis::cmd("SET")
            .arg(key)
            .arg(data)
            .query_async::<()>(&mut db.connection().clone())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Remove migration record
    async fn remove_migration(&self, db: &TormDb, migration_id: &str) -> Result<()> {
        let key = "torm:migrations";
        let mut migrations = self.get_applied_migrations(db).await?;
        migrations.remove(migration_id);

        let data =
            serde_json::to_string(&migrations).map_err(|e| Error::Serialization(e.to_string()))?;

        redis::cmd("SET")
            .arg(key)
            .arg(data)
            .query_async::<()>(&mut db.connection().clone())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    fn calculate_checksum(&self, id: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        id.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
}

impl Default for MigrationManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub enum MigrationStatus {
    Applied {
        name: String,
        applied_at: DateTime<Utc>,
    },
    Pending {
        name: String,
    },
}
