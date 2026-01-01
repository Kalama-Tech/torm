<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Toonstore\Torm\TormClient;

echo "🚀 TORM PHP SDK - Basic Usage Example\n\n";

// 1. Connect to TORM server
echo "Connecting to TORM server...\n";
$torm = new TormClient('http://localhost:3001');

try {
    $health = $torm->health();
    echo "✅ Connected! Status: " . ($health['status'] ?? 'unknown') . "\n\n";
} catch (Exception $e) {
    echo "❌ Failed to connect: {$e->getMessage()}\n";
    exit(1);
}

// 2. Define User model with validation
echo "Defining User model...\n";
$User = $torm->model('User', [
    'name' => ['type' => 'string', 'required' => true, 'min_length' => 3],
    'email' => ['type' => 'string', 'required' => true, 'email' => true],
    'age' => ['type' => 'integer', 'min' => 13, 'max' => 120],
    'active' => ['type' => 'boolean']
]);
echo "✅ User model defined\n\n";

// 3. Create users
echo "Creating users...\n";
try {
    $alice = $User->create([
        'id' => 'user:alice',
        'name' => 'Alice Smith',
        'email' => 'alice@example.com',
        'age' => 30,
        'active' => true
    ]);
    echo "✅ Created: " . $alice['name'] . "\n";
    
    $bob = $User->create([
        'id' => 'user:bob',
        'name' => 'Bob Johnson',
        'email' => 'bob@example.com',
        'age' => 25,
        'active' => true
    ]);
    echo "✅ Created: " . $bob['name'] . "\n";
    
    $charlie = $User->create([
        'id' => 'user:charlie',
        'name' => 'Charlie Brown',
        'email' => 'charlie@example.com',
        'age' => 35,
        'active' => false
    ]);
    echo "✅ Created: " . $charlie['name'] . "\n\n";
} catch (Exception $e) {
    echo "❌ Failed to create user: {$e->getMessage()}\n\n";
}

// 4. Find all users
echo "Finding all users...\n";
try {
    $allUsers = $User->find();
    echo "✅ Found " . count($allUsers) . " users\n";
    foreach ($allUsers as $user) {
        echo "   - {$user['name']} ({$user['email']})\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "❌ Failed to find users: {$e->getMessage()}\n\n";
}

// 5. Find user by ID
echo "Finding user by ID...\n";
try {
    $user = $User->findById('user:alice');
    if ($user) {
        echo "✅ Found: " . $user['name'] . "\n\n";
    } else {
        echo "❌ User not found\n\n";
    }
} catch (Exception $e) {
    echo "❌ Failed to find user: {$e->getMessage()}\n\n";
}

// 6. Query with filters
echo "Querying active users over 25...\n";
try {
    $results = $User->query()
        ->filter('active', 'eq', true)
        ->filter('age', 'gte', 25)
        ->sort('age', 'asc')
        ->exec();
    
    echo "✅ Found " . count($results) . " matching users:\n";
    foreach ($results as $user) {
        echo "   - {$user['name']}, age {$user['age']}\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "❌ Query failed: {$e->getMessage()}\n\n";
}

// 7. Update user
echo "Updating user...\n";
try {
    $updated = $User->update('user:bob', ['age' => 26]);
    echo "✅ Updated: {$updated['name']}, new age: {$updated['age']}\n\n";
} catch (Exception $e) {
    echo "❌ Failed to update user: {$e->getMessage()}\n\n";
}

// 8. Count users
echo "Counting users...\n";
try {
    $count = $User->count();
    echo "✅ Total users: $count\n\n";
} catch (Exception $e) {
    echo "❌ Failed to count users: {$e->getMessage()}\n\n";
}

// 9. Validation demo
echo "Testing validation...\n";
try {
    $User->create([
        'id' => 'user:invalid',
        'name' => 'Invalid User',
        'email' => 'not-an-email',
        'age' => 30
    ]);
    echo "❌ Validation didn't catch invalid email\n\n";
} catch (Exception $e) {
    echo "✅ Validation caught error: {$e->getMessage()}\n\n";
}

// 10. Delete user
echo "Deleting user...\n";
try {
    $success = $User->delete('user:charlie');
    if ($success) {
        echo "✅ User deleted successfully\n\n";
    } else {
        echo "❌ Failed to delete user\n\n";
    }
} catch (Exception $e) {
    echo "❌ Failed to delete user: {$e->getMessage()}\n\n";
}

// 11. Verify deletion
echo "Verifying deletion...\n";
try {
    $user = $User->findById('user:charlie');
    if ($user === null) {
        echo "✅ User successfully deleted\n\n";
    } else {
        echo "❌ User still exists\n\n";
    }
} catch (Exception $e) {
    echo "❌ Failed to verify: {$e->getMessage()}\n\n";
}

echo "🎉 Example completed!\n";
