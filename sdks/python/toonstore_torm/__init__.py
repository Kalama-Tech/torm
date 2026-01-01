"""
ToonStore TORM - Python ORM Client for ToonStore

A Mongoose-style ORM client for ToonStore database.
"""

from .client import TormClient
from .model import Model
from .query import QueryBuilder
from .exceptions import ValidationError, TormError

__version__ = "0.1.0"
__all__ = ["TormClient", "Model", "QueryBuilder", "ValidationError", "TormError"]
