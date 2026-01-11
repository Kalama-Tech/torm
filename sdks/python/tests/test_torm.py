"""
TORM Python SDK Tests

Tests for ToonStore ORM Client
"""

import pytest
import os
from toonstore_torm import TormClient, ValidationError, TormError


# Test configuration
TEST_CONFIG = {
    'base_url': os.getenv('TORM_URL', 'http://localhost:3001'),
    'timeout': 10
}


@pytest.fixture
def torm_client():
    """Create a TORM client for testing"""
    client = TormClient(**TEST_CONFIG)
    yield client


@pytest.fixture
def user_model(torm_client):
    """Create a User model for testing"""
    User = torm_client.model('TestUser', {
        'name': {'type': 'str', 'required': True, 'min_length': 3, 'max_length': 50},
        'email': {'type': 'str', 'required': True, 'email': True},
        'age': {'type': 'int', 'required': True, 'min': 13, 'max': 120},
        'website': {'type': 'str', 'url': True}
    })
    
    # Clean up before tests
    try:
        User.delete_many()
    except:
        pass
    
    yield User
    
    # Clean up after tests
    try:
        User.delete_many()
    except:
        pass


@pytest.fixture
def product_model(torm_client):
    """Create a Product model for testing"""
    Product = torm_client.model('TestProduct', {
        'name': {'type': 'str', 'required': True},
        'price': {'type': 'float', 'required': True, 'min': 0},
        'stock': {'type': 'int', 'required': True, 'min': 0},
        'sku': {'type': 'str', 'required': True, 'pattern': r'^[A-Z]{3}-\d{5}$'}
    })
    
    # Clean up before tests
    try:
        Product.delete_many()
    except:
        pass
    
    yield Product
    
    # Clean up after tests
    try:
        Product.delete_many()
    except:
        pass


class TestTormClient:
    """Test TormClient functionality"""

    def test_client_creation(self, torm_client):
        """Test client can be created"""
        assert torm_client is not None

    def test_health_check(self, torm_client):
        """Test health check endpoint"""
        health = torm_client.health()
        assert 'status' in health
        assert health['status'] in ['ok', 'healthy']

    def test_info_check(self, torm_client):
        """Test info endpoint"""
        info = torm_client.info()
        assert 'name' in info or 'version' in info

    def test_model_creation(self, torm_client):
        """Test model creation"""
        User = torm_client.model('TestUser', {
            'name': {'type': 'str', 'required': True}
        })
        assert User is not None


class TestModelCRUD:
    """Test Model CRUD operations"""

    def test_create_document(self, user_model):
        """Test creating a document"""
        user = user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        assert user['id'] == 'test:user:1'
        assert user['name'] == 'Alice'
        assert user['email'] == 'alice@example.com'
        assert user['age'] == 30

    def test_find_all_documents(self, user_model):
        """Test finding all documents"""
        user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        user_model.create({
            'id': 'test:user:2',
            'name': 'Bob',
            'email': 'bob@example.com',
            'age': 25
        })
        
        users = user_model.find()
        assert len(users) == 2

    def test_find_by_id(self, user_model):
        """Test finding document by ID"""
        created = user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        
        found = user_model.find_by_id('test:user:1')
        assert found is not None
        assert found['id'] == created['id']
        assert found['name'] == 'Alice'

    def test_update_document(self, user_model):
        """Test updating a document"""
        user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        
        updated = user_model.update('test:user:1', {'age': 31})
        assert updated is not None
        assert updated['age'] == 31

    def test_delete_document(self, user_model):
        """Test deleting a document"""
        user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        
        success = user_model.delete('test:user:1')
        assert success is True
        
        found = user_model.find_by_id('test:user:1')
        assert found is None

    def test_count_documents(self, user_model):
        """Test counting documents"""
        user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        user_model.create({
            'id': 'test:user:2',
            'name': 'Bob',
            'email': 'bob@example.com',
            'age': 25
        })
        
        count = user_model.count()
        assert count == 2

    def test_delete_all_documents(self, user_model):
        """Test deleting all documents"""
        user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        user_model.create({
            'id': 'test:user:2',
            'name': 'Bob',
            'email': 'bob@example.com',
            'age': 25
        })
        
        deleted = user_model.delete_many()
        assert deleted == 2
        
        count = user_model.count()
        assert count == 0


class TestValidation:
    """Test validation functionality"""

    def test_required_field_validation(self, user_model):
        """Test required field validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Alice',
                'age': 30
                # Missing required email
            })

    def test_string_min_length_validation(self, user_model):
        """Test string minimum length validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Al',  # Too short
                'email': 'alice@example.com',
                'age': 30
            })

    def test_string_max_length_validation(self, user_model):
        """Test string maximum length validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'A' * 51,  # Too long
                'email': 'alice@example.com',
                'age': 30
            })

    def test_email_validation(self, user_model):
        """Test email format validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Alice',
                'email': 'invalid-email',
                'age': 30
            })

    def test_url_validation(self, user_model):
        """Test URL format validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Alice',
                'email': 'alice@example.com',
                'age': 30,
                'website': 'not-a-url'
            })

    def test_number_min_validation(self, user_model):
        """Test number minimum validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Alice',
                'email': 'alice@example.com',
                'age': 12  # Too young
            })

    def test_number_max_validation(self, user_model):
        """Test number maximum validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Alice',
                'email': 'alice@example.com',
                'age': 121  # Too old
            })

    def test_type_validation(self, user_model):
        """Test type validation"""
        with pytest.raises(ValidationError):
            user_model.create({
                'id': 'test:user:1',
                'name': 'Alice',
                'email': 'alice@example.com',
                'age': '30'  # Should be int
            })

    def test_pattern_validation(self, product_model):
        """Test pattern validation"""
        with pytest.raises(ValidationError):
            product_model.create({
                'id': 'test:product:1',
                'name': 'Laptop',
                'price': 999.99,
                'stock': 10,
                'sku': 'invalid'  # Doesn't match pattern
            })

    def test_valid_pattern(self, product_model):
        """Test valid pattern passes"""
        product = product_model.create({
            'id': 'test:product:1',
            'name': 'Laptop',
            'price': 999.99,
            'stock': 10,
            'sku': 'LAP-12345'
        })
        assert product['sku'] == 'LAP-12345'


class TestQueryBuilder:
    """Test Query Builder functionality"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self, user_model):
        """Create test data before each test"""
        user_model.delete_many()
        
        user_model.create({
            'id': 'test:user:1',
            'name': 'Alice',
            'email': 'alice@example.com',
            'age': 30
        })
        user_model.create({
            'id': 'test:user:2',
            'name': 'Bob',
            'email': 'bob@example.com',
            'age': 25
        })
        user_model.create({
            'id': 'test:user:3',
            'name': 'Charlie',
            'email': 'charlie@example.com',
            'age': 35
        })
        user_model.create({
            'id': 'test:user:4',
            'name': 'Diana',
            'email': 'diana@example.com',
            'age': 28
        })

    def test_filter_equals(self, user_model):
        """Test filter with equals operator"""
        results = user_model.query().filter('age', 'eq', 30).exec()
        assert len(results) == 1
        assert results[0]['name'] == 'Alice'

    def test_filter_greater_than(self, user_model):
        """Test filter with greater than operator"""
        results = user_model.query().filter('age', 'gt', 30).exec()
        assert len(results) == 1
        assert results[0]['name'] == 'Charlie'

    def test_filter_greater_than_or_equal(self, user_model):
        """Test filter with greater than or equal operator"""
        results = user_model.query().filter('age', 'gte', 30).exec()
        assert len(results) == 2

    def test_filter_less_than(self, user_model):
        """Test filter with less than operator"""
        results = user_model.query().filter('age', 'lt', 30).exec()
        assert len(results) == 2

    def test_filter_less_than_or_equal(self, user_model):
        """Test filter with less than or equal operator"""
        results = user_model.query().filter('age', 'lte', 30).exec()
        assert len(results) == 3

    def test_filter_contains(self, user_model):
        """Test filter with contains operator"""
        results = user_model.query().filter('email', 'contains', 'alice').exec()
        assert len(results) == 1
        assert results[0]['name'] == 'Alice'

    def test_chained_filters(self, user_model):
        """Test chaining multiple filters"""
        results = user_model.query() \
            .filter('age', 'gte', 25) \
            .filter('age', 'lte', 30) \
            .exec()
        assert len(results) == 3

    def test_sort_ascending(self, user_model):
        """Test sorting in ascending order"""
        results = user_model.query().sort('age', 'asc').exec()
        assert results[0]['name'] == 'Bob'
        assert results[-1]['name'] == 'Charlie'

    def test_sort_descending(self, user_model):
        """Test sorting in descending order"""
        results = user_model.query().sort('age', 'desc').exec()
        assert results[0]['name'] == 'Charlie'
        assert results[-1]['name'] == 'Bob'

    def test_limit_results(self, user_model):
        """Test limiting results"""
        results = user_model.query().limit(2).exec()
        assert len(results) == 2

    def test_skip_results(self, user_model):
        """Test skipping results"""
        results = user_model.query().sort('age', 'asc').skip(2).exec()
        assert len(results) == 2
        assert results[0]['age'] >= 30

    def test_combined_query(self, user_model):
        """Test combining filter, sort, limit, and skip"""
        results = user_model.query() \
            .filter('age', 'gte', 25) \
            .sort('age', 'asc') \
            .skip(1) \
            .limit(2) \
            .exec()
        assert len(results) == 2
        assert results[0]['age'] == 28

    def test_count_filtered_results(self, user_model):
        """Test counting filtered results"""
        count = user_model.query().filter('age', 'gte', 30).count()
        assert count == 2

    def test_where_shorthand(self, user_model):
        """Test where shorthand for equals"""
        results = user_model.query().where('name', 'Bob').exec()
        assert len(results) == 1
        assert results[0]['email'] == 'bob@example.com'


class TestContextManager:
    """Test context manager functionality"""

    def test_context_manager(self):
        """Test using TormClient as context manager"""
        with TormClient(**TEST_CONFIG) as torm:
            User = torm.model('TestUser', {
                'name': {'type': 'str', 'required': True}
            })
            assert User is not None


if __name__ == '__main__':
    print('✅ Python TORM tests ready - run with: pytest tests/test_torm.py -v')
