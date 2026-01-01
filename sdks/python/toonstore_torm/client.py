"""TormClient - Main client for connecting to ToonStore"""

import requests
from typing import Optional, Dict, Any
from .model import Model
from .exceptions import ConnectionError


class TormClient:
    """
    ToonStore ORM Client
    
    Example:
        >>> torm = TormClient('http://localhost:3001')
        >>> User = torm.model('User', {
        ...     'name': {'type': 'str', 'required': True},
        ...     'email': {'type': 'str', 'email': True}
        ... })
    """
    
    def __init__(self, base_url: str = 'http://localhost:3001', timeout: int = 5):
        """
        Initialize TORM client
        
        Args:
            base_url: Base URL of TORM server (default: http://localhost:3001)
            timeout: Request timeout in seconds (default: 5)
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def model(self, name: str, schema: Optional[Dict[str, Any]] = None, 
              collection: Optional[str] = None, validate: bool = True) -> Model:
        """
        Create a new model class
        
        Args:
            name: Model name
            schema: Validation schema dictionary
            collection: Collection name (defaults to lowercase model name)
            validate: Enable validation (default: True)
        
        Returns:
            Model instance
        """
        return Model(self, name, schema, collection, validate)
    
    def health(self) -> Dict[str, Any]:
        """
        Check server health
        
        Returns:
            Health status dictionary
        """
        try:
            response = self.session.get(f'{self.base_url}/health', timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise ConnectionError(f"Failed to connect to server: {e}")
    
    def info(self) -> Dict[str, Any]:
        """
        Get server info
        
        Returns:
            Server information dictionary
        """
        try:
            response = self.session.get(f'{self.base_url}/', timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise ConnectionError(f"Failed to get server info: {e}")
    
    def close(self):
        """Close the client session"""
        self.session.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
