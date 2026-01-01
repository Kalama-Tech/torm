"""
TORM - ToonStore ORM for Python

Mongoose-style ORM for ToonStore with type-safe models,
validation, and relationships.
"""

import json
from typing import Any, Dict, List, Optional, Type, TypeVar
from dataclasses import dataclass, field, asdict
import httpx
from datetime import datetime

__version__ = "0.1.0"

T = TypeVar('T', bound='Model')


class ValidationError(Exception):
    """Validation error"""
    pass


class TormClient:
    """TORM client for connecting to ToonStore"""
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        """
        Initialize TORM client
        
        Args:
            base_url: Base URL of TORM server
        """
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


class Model:
    """Base model class for TORM"""
    
    _collection: str = ""
    _client: Optional[TormClient] = None
    
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    @classmethod
    def set_client(cls, client: TormClient):
        """Set the TORM client for this model"""
        cls._client = client
    
    @classmethod
    def set_collection(cls, collection: str):
        """Set the collection name for this model"""
        cls._collection = collection
    
    @classmethod
    async def create(cls: Type[T], data: Dict[str, Any]) -> T:
        """
        Create a new document
        
        Args:
            data: Document data
            
        Returns:
            Created model instance
        """
        if not cls._client:
            raise ValueError("Client not set. Call Model.set_client() first")
        
        response = await cls._client.client.post(
            f"{cls._client.base_url}/api/{cls._collection}",
            json={"data": data}
        )
        response.raise_for_status()
        result = response.json()
        return cls(**result['data'])
    
    async def save(self) -> 'Model':
        """
        Save this document
        
        Returns:
            Self
        """
        if not self._client:
            raise ValueError("Client not set. Call Model.set_client() first")
        
        data = self.to_dict()
        
        if hasattr(self, 'id') and self.id:
            # Update existing
            response = await self._client.client.put(
                f"{self._client.base_url}/api/{self._collection}/{self.id}",
                json={"data": data}
            )
        else:
            # Create new
            response = await self._client.client.post(
                f"{self._client.base_url}/api/{self._collection}",
                json={"data": data}
            )
            result = response.json()
            if 'id' in result:
                self.id = result['id']
        
        response.raise_for_status()
        return self
    
    @classmethod
    async def find_by_id(cls: Type[T], id: str) -> Optional[T]:
        """
        Find document by ID
        
        Args:
            id: Document ID
            
        Returns:
            Model instance or None
        """
        if not cls._client:
            raise ValueError("Client not set. Call Model.set_client() first")
        
        try:
            response = await cls._client.client.get(
                f"{cls._client.base_url}/api/{cls._collection}/{id}"
            )
            response.raise_for_status()
            data = response.json()
            return cls(**data)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise
    
    @classmethod
    async def find(cls: Type[T], filters: Optional[Dict[str, Any]] = None) -> List[T]:
        """
        Find documents matching filters
        
        Args:
            filters: Query filters
            
        Returns:
            List of model instances
        """
        if not cls._client:
            raise ValueError("Client not set. Call Model.set_client() first")
        
        if filters:
            response = await cls._client.client.post(
                f"{cls._client.base_url}/api/{cls._collection}/query",
                json={"filters": filters}
            )
        else:
            response = await cls._client.client.get(
                f"{cls._client.base_url}/api/{cls._collection}"
            )
        
        response.raise_for_status()
        result = response.json()
        return [cls(**doc) for doc in result.get('documents', [])]
    
    @classmethod
    async def count(cls) -> int:
        """
        Count documents in collection
        
        Returns:
            Document count
        """
        if not cls._client:
            raise ValueError("Client not set. Call Model.set_client() first")
        
        response = await cls._client.client.get(
            f"{cls._client.base_url}/api/{cls._collection}/count"
        )
        response.raise_for_status()
        result = response.json()
        return result.get('count', 0)
    
    async def delete(self) -> bool:
        """
        Delete this document
        
        Returns:
            True if deleted, False otherwise
        """
        if not self._client:
            raise ValueError("Client not set. Call Model.set_client() first")
        
        if not hasattr(self, 'id') or not self.id:
            return False
        
        response = await self._client.client.delete(
            f"{self._client.base_url}/api/{self._collection}/{self.id}"
        )
        response.raise_for_status()
        result = response.json()
        return result.get('success', False)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary"""
        result = {}
        for key, value in self.__dict__.items():
            if not key.startswith('_'):
                if isinstance(value, datetime):
                    result[key] = value.isoformat()
                elif isinstance(value, Model):
                    result[key] = value.to_dict()
                else:
                    result[key] = value
        return result
    
    def __repr__(self) -> str:
        attrs = ', '.join(f"{k}={v!r}" for k, v in self.to_dict().items())
        return f"{self.__class__.__name__}({attrs})"


class MigrationManager:
    """Migration manager for schema changes"""
    
    def __init__(self, client: TormClient):
        self.client = client
        self.migrations: List[Dict[str, Any]] = []
    
    def add_migration(
        self,
        id: str,
        name: str,
        up: callable,
        down: callable
    ):
        """
        Add a migration
        
        Args:
            id: Migration ID
            name: Migration name
            up: Function to apply migration
            down: Function to rollback migration
        """
        self.migrations.append({
            'id': id,
            'name': name,
            'up': up,
            'down': down
        })
    
    async def migrate(self) -> List[str]:
        """
        Run all pending migrations
        
        Returns:
            List of applied migration names
        """
        applied = await self._get_applied_migrations()
        newly_applied = []
        
        for migration in self.migrations:
            if migration['id'] not in applied:
                # Run migration
                await migration['up'](self.client)
                
                # Record migration
                await self._save_migration({
                    'id': migration['id'],
                    'name': migration['name'],
                    'applied_at': datetime.now().isoformat()
                })
                
                newly_applied.append(migration['name'])
        
        return newly_applied
    
    async def rollback(self, steps: int = 1) -> List[str]:
        """
        Rollback last N migrations
        
        Args:
            steps: Number of migrations to rollback
            
        Returns:
            List of rolled back migration names
        """
        applied = await self._get_applied_migrations()
        rolled_back = []
        
        # Sort by applied_at descending
        sorted_migrations = sorted(
            applied.values(),
            key=lambda x: x['applied_at'],
            reverse=True
        )
        
        for record in sorted_migrations[:steps]:
            # Find migration
            migration = next(
                (m for m in self.migrations if m['id'] == record['id']),
                None
            )
            
            if migration:
                # Run down migration
                await migration['down'](self.client)
                
                # Remove migration record
                await self._remove_migration(record['id'])
                rolled_back.append(record['name'])
        
        return rolled_back
    
    async def status(self) -> Dict[str, str]:
        """
        Get migration status
        
        Returns:
            Dictionary of migration IDs to status
        """
        applied = await self._get_applied_migrations()
        status = {}
        
        for migration in self.migrations:
            if migration['id'] in applied:
                record = applied[migration['id']]
                status[migration['id']] = f"Applied ({record['applied_at']})"
            else:
                status[migration['id']] = "Pending"
        
        return status
    
    async def _get_applied_migrations(self) -> Dict[str, Dict[str, Any]]:
        """Get applied migrations from database"""
        try:
            response = await self.client.client.get(
                f"{self.client.base_url}/api/keys/torm:migrations"
            )
            if response.status_code == 200:
                data = response.json()
                return json.loads(data.get('value', '{}'))
        except:
            pass
        return {}
    
    async def _save_migration(self, migration: Dict[str, Any]):
        """Save migration record"""
        migrations = await self._get_applied_migrations()
        migrations[migration['id']] = migration
        
        await self.client.client.put(
            f"{self.client.base_url}/api/keys/torm:migrations",
            json={"value": json.dumps(migrations)}
        )
    
    async def _remove_migration(self, migration_id: str):
        """Remove migration record"""
        migrations = await self._get_applied_migrations()
        if migration_id in migrations:
            del migrations[migration_id]
            
            await self.client.client.put(
                f"{self.client.base_url}/api/keys/torm:migrations",
                json={"value": json.dumps(migrations)}
            )


__all__ = [
    'TormClient',
    'Model',
    'MigrationManager',
    'ValidationError',
]
