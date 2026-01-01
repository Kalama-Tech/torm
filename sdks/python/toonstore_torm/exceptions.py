"""Exception classes for TORM"""


class TormError(Exception):
    """Base exception for TORM errors"""
    pass


class ValidationError(TormError):
    """Raised when validation fails"""
    pass


class ConnectionError(TormError):
    """Raised when connection to server fails"""
    pass


class NotFoundError(TormError):
    """Raised when document is not found"""
    pass
