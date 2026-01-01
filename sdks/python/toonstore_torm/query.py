"""Query builder for TORM"""

import requests
from typing import List, Dict, Any, Optional, Literal, TYPE_CHECKING
from .exceptions import TormError

if TYPE_CHECKING:
    from .client import TormClient

QueryOperator = Literal['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not_in']
SortOrder = Literal['asc', 'desc']


class QueryBuilder:
    """
    Query builder for constructing complex queries
    
    Example:
        >>> results = User.query()\\
        ...     .filter('age', 'gte', 18)\\
        ...     .filter('active', 'eq', True)\\
        ...     .sort('name', 'asc')\\
        ...     .limit(10)\\
        ...     .exec()
    """
    
    def __init__(self, client: 'TormClient', collection: str):
        self.client = client
        self.collection = collection
        self.filters: List[Dict[str, Any]] = []
        self.sort_field: Optional[str] = None
        self.sort_order: SortOrder = 'asc'
        self.limit_value: Optional[int] = None
        self.skip_value: Optional[int] = None
    
    def filter(self, field: str, operator: QueryOperator, value: Any) -> 'QueryBuilder':
        """
        Add a filter condition
        
        Args:
            field: Field name
            operator: Comparison operator
            value: Comparison value
        
        Returns:
            Self for chaining
        """
        self.filters.append({
            'field': field,
            'operator': operator,
            'value': value
        })
        return self
    
    def where(self, field: str, value: Any) -> 'QueryBuilder':
        """
        Add an equality filter (shorthand for filter with 'eq')
        
        Args:
            field: Field name
            value: Expected value
        
        Returns:
            Self for chaining
        """
        return self.filter(field, 'eq', value)
    
    def sort(self, field: str, order: SortOrder = 'asc') -> 'QueryBuilder':
        """
        Sort results
        
        Args:
            field: Field to sort by
            order: Sort order ('asc' or 'desc')
        
        Returns:
            Self for chaining
        """
        self.sort_field = field
        self.sort_order = order
        return self
    
    def limit(self, n: int) -> 'QueryBuilder':
        """
        Limit number of results
        
        Args:
            n: Maximum number of results
        
        Returns:
            Self for chaining
        """
        self.limit_value = n
        return self
    
    def skip(self, n: int) -> 'QueryBuilder':
        """
        Skip number of results
        
        Args:
            n: Number of results to skip
        
        Returns:
            Self for chaining
        """
        self.skip_value = n
        return self
    
    def exec(self) -> List[Dict[str, Any]]:
        """
        Execute the query
        
        Returns:
            List of matching documents
        """
        query_data: Dict[str, Any] = {}
        
        if self.filters:
            query_data['filters'] = self.filters
        if self.sort_field:
            query_data['sort'] = {'field': self.sort_field, 'order': self.sort_order}
        if self.limit_value is not None:
            query_data['limit'] = self.limit_value
        if self.skip_value is not None:
            query_data['skip'] = self.skip_value
        
        try:
            response = self.client.session.post(
                f'{self.client.base_url}/api/{self.collection}/query',
                json=query_data,
                timeout=self.client.timeout
            )
            response.raise_for_status()
            documents = response.json().get('documents', [])
            
            # Apply client-side filtering
            if self.filters:
                documents = [doc for doc in documents if self._matches_filters(doc)]
            
            # Apply client-side sorting
            if self.sort_field:
                documents.sort(
                    key=lambda x: x.get(self.sort_field, ''),
                    reverse=(self.sort_order == 'desc')
                )
            
            return documents
            
        except requests.RequestException as e:
            raise TormError(f"Failed to execute query: {e}")
    
    def count(self) -> int:
        """
        Count matching documents
        
        Returns:
            Number of matching documents
        """
        return len(self.exec())
    
    def _matches_filters(self, doc: Dict[str, Any]) -> bool:
        """Check if document matches all filters"""
        for f in self.filters:
            field = f['field']
            operator = f['operator']
            value = f['value']
            doc_value = doc.get(field)
            
            if not self._matches_filter(doc_value, operator, value):
                return False
        return True
    
    @staticmethod
    def _matches_filter(doc_value: Any, operator: str, filter_value: Any) -> bool:
        """Check if value matches filter"""
        if operator == 'eq':
            return doc_value == filter_value
        elif operator == 'ne':
            return doc_value != filter_value
        elif operator == 'gt':
            return doc_value > filter_value
        elif operator == 'gte':
            return doc_value >= filter_value
        elif operator == 'lt':
            return doc_value < filter_value
        elif operator == 'lte':
            return doc_value <= filter_value
        elif operator == 'contains':
            return filter_value in str(doc_value)
        elif operator == 'in':
            return doc_value in filter_value
        elif operator == 'not_in':
            return doc_value not in filter_value
        return False
