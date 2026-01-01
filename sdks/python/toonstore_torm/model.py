"""Model class for TORM"""

import re
import requests
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from .exceptions import ValidationError, NotFoundError, TormError
from .query import QueryBuilder

if TYPE_CHECKING:
    from .client import TormClient


class Model:
    """
    Model class for database operations
    
    Example:
        >>> User = torm.model('User', {
        ...     'name': {'type': 'str', 'required': True, 'min_length': 3},
        ...     'email': {'type': 'str', 'email': True},
        ...     'age': {'type': 'int', 'min': 13, 'max': 120}
        ... })
        >>> user = User.create({'name': 'Alice', 'email': 'alice@example.com', 'age': 30})
    """
    
    def __init__(self, client: 'TormClient', name: str, schema: Optional[Dict[str, Any]] = None,
                 collection: Optional[str] = None, validate: bool = True):
        self.client = client
        self.name = name
        self.collection = collection or name.lower()
        self.schema = schema or {}
        self.validate_enabled = validate
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new document
        
        Args:
            data: Document data
        
        Returns:
            Created document
        """
        if self.validate_enabled and self.schema:
            self._validate(data)
        
        try:
            response = self.client.session.post(
                f'{self.client.base_url}/api/{self.collection}',
                json={'data': data},
                timeout=self.client.timeout
            )
            response.raise_for_status()
            return response.json().get('data', {})
        except requests.RequestException as e:
            raise TormError(f"Failed to create document: {e}")
    
    def find(self) -> List[Dict[str, Any]]:
        """
        Find all documents
        
        Returns:
            List of documents
        """
        try:
            response = self.client.session.get(
                f'{self.client.base_url}/api/{self.collection}',
                timeout=self.client.timeout
            )
            response.raise_for_status()
            return response.json().get('documents', [])
        except requests.RequestException as e:
            raise TormError(f"Failed to find documents: {e}")
    
    def find_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Find document by ID
        
        Args:
            doc_id: Document ID
        
        Returns:
            Document or None if not found
        """
        try:
            response = self.client.session.get(
                f'{self.client.base_url}/api/{self.collection}/{doc_id}',
                timeout=self.client.timeout
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if hasattr(e, 'response') and e.response.status_code == 404:
                return None
            raise TormError(f"Failed to find document: {e}")
    
    def update(self, doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update document by ID
        
        Args:
            doc_id: Document ID
            data: Update data
        
        Returns:
            Updated document
        """
        if self.validate_enabled and self.schema:
            self._validate(data, partial=True)
        
        try:
            response = self.client.session.put(
                f'{self.client.base_url}/api/{self.collection}/{doc_id}',
                json={'data': data},
                timeout=self.client.timeout
            )
            response.raise_for_status()
            return response.json().get('data', {})
        except requests.RequestException as e:
            raise TormError(f"Failed to update document: {e}")
    
    def delete(self, doc_id: str) -> bool:
        """
        Delete document by ID
        
        Args:
            doc_id: Document ID
        
        Returns:
            True if deleted successfully
        """
        try:
            response = self.client.session.delete(
                f'{self.client.base_url}/api/{self.collection}/{doc_id}',
                timeout=self.client.timeout
            )
            response.raise_for_status()
            return response.json().get('success', False)
        except requests.RequestException as e:
            raise TormError(f"Failed to delete document: {e}")
    
    def count(self) -> int:
        """
        Count all documents
        
        Returns:
            Document count
        """
        try:
            response = self.client.session.get(
                f'{self.client.base_url}/api/{self.collection}/count',
                timeout=self.client.timeout
            )
            response.raise_for_status()
            return response.json().get('count', 0)
        except requests.RequestException as e:
            raise TormError(f"Failed to count documents: {e}")
    
    def query(self) -> QueryBuilder:
        """
        Create a query builder
        
        Returns:
            QueryBuilder instance
        """
        return QueryBuilder(self.client, self.collection)
    
    def _validate(self, data: Dict[str, Any], partial: bool = False):
        """Validate data against schema"""
        for field, rules in self.schema.items():
            value = data.get(field)
            
            # Required check
            if rules.get('required', False) and not partial:
                if value is None:
                    raise ValidationError(f"Field '{field}' is required")
            
            # Skip if value is None and not required
            if value is None:
                continue
            
            # Type check
            expected_type = rules.get('type')
            if expected_type:
                if not self._check_type(value, expected_type):
                    raise ValidationError(f"Field '{field}' must be of type {expected_type}")
            
            # String validations
            if isinstance(value, str):
                if 'min_length' in rules and len(value) < rules['min_length']:
                    raise ValidationError(
                        f"Field '{field}' must be at least {rules['min_length']} characters"
                    )
                if 'max_length' in rules and len(value) > rules['max_length']:
                    raise ValidationError(
                        f"Field '{field}' must be at most {rules['max_length']} characters"
                    )
                if rules.get('email', False) and not self._is_email(value):
                    raise ValidationError(f"Field '{field}' must be a valid email")
                if rules.get('url', False) and not self._is_url(value):
                    raise ValidationError(f"Field '{field}' must be a valid URL")
                if 'pattern' in rules and not re.match(rules['pattern'], value):
                    raise ValidationError(f"Field '{field}' does not match pattern")
            
            # Number validations
            if isinstance(value, (int, float)):
                if 'min' in rules and value < rules['min']:
                    raise ValidationError(f"Field '{field}' must be at least {rules['min']}")
                if 'max' in rules and value > rules['max']:
                    raise ValidationError(f"Field '{field}' must be at most {rules['max']}")
            
            # Custom validation
            if 'validate' in rules:
                validator = rules['validate']
                if callable(validator) and not validator(value):
                    raise ValidationError(f"Field '{field}' failed custom validation")
    
    @staticmethod
    def _check_type(value: Any, expected_type: str) -> bool:
        """Check if value matches expected type"""
        type_map = {
            'str': str,
            'int': int,
            'float': float,
            'bool': bool,
            'list': list,
            'dict': dict,
        }
        expected_class = type_map.get(expected_type)
        if expected_class:
            return isinstance(value, expected_class)
        return True
    
    @staticmethod
    def _is_email(value: str) -> bool:
        """Check if value is a valid email"""
        return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value))
    
    @staticmethod
    def _is_url(value: str) -> bool:
        """Check if value is a valid URL"""
        return bool(re.match(r'^https?://.+', value))
