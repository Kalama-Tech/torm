<?php

namespace Toonstore\Torm\Tests;

use PHPUnit\Framework\TestCase;
use Toonstore\Torm\TormClient;
use Toonstore\Torm\Model;

class TormTest extends TestCase
{
    private $torm;
    private $baseUrl;

    protected function setUp(): void
    {
        $this->baseUrl = getenv('TORM_URL') ?: 'http://localhost:3001';
        $this->torm = new TormClient($this->baseUrl);
    }

    public function testClientCreation()
    {
        $this->assertInstanceOf(TormClient::class, $this->torm);
    }

    public function testHealthCheck()
    {
        $health = $this->torm->health();
        $this->assertArrayHasKey('status', $health);
        $this->assertContains($health['status'], ['ok', 'healthy']);
    }

    public function testInfoCheck()
    {
        $info = $this->torm->info();
        $this->assertTrue(
            isset($info['name']) || isset($info['version']),
            'Info should contain name or version'
        );
    }

    public function testModelCreation()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true, 'email' => true],
            'age' => ['type' => 'integer', 'required' => true, 'min' => 13, 'max' => 120]
        ]);

        $this->assertInstanceOf(Model::class, $User);
    }

    public function testCreateDocument()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true, 'min_length' => 3],
            'email' => ['type' => 'string', 'required' => true, 'email' => true],
            'age' => ['type' => 'integer', 'required' => true]
        ]);

        // Clean up
        $User->deleteMany();

        $user = $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 30
        ]);

        $this->assertEquals('test:user:1', $user['id']);
        $this->assertEquals('Alice', $user['name']);
        $this->assertEquals('alice@example.com', $user['email']);
        $this->assertEquals(30, $user['age']);
    }

    public function testFindAllDocuments()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 30
        ]);

        $User->create([
            'id' => 'test:user:2',
            'name' => 'Bob',
            'email' => 'bob@example.com',
            'age' => 25
        ]);

        $users = $User->find();
        $this->assertCount(2, $users);
    }

    public function testFindById()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $created = $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 30
        ]);

        $found = $User->findById('test:user:1');
        $this->assertNotNull($found);
        $this->assertEquals($created['id'], $found['id']);
        $this->assertEquals('Alice', $found['name']);
    }

    public function testUpdateDocument()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $user = $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 30
        ]);

        $updated = $User->update('test:user:1', ['age' => 31]);
        $this->assertNotNull($updated);
        $this->assertEquals(31, $updated['age']);
    }

    public function testDeleteDocument()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $user = $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 30
        ]);

        $success = $User->delete('test:user:1');
        $this->assertTrue($success);

        $found = $User->findById('test:user:1');
        $this->assertNull($found);
    }

    public function testCountDocuments()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 30
        ]);

        $User->create([
            'id' => 'test:user:2',
            'name' => 'Bob',
            'email' => 'bob@example.com',
            'age' => 25
        ]);

        $count = $User->count();
        $this->assertEquals(2, $count);
    }

    public function testQueryWithFilter()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $User->create(['id' => 'test:user:1', 'name' => 'Alice', 'email' => 'alice@example.com', 'age' => 30]);
        $User->create(['id' => 'test:user:2', 'name' => 'Bob', 'email' => 'bob@example.com', 'age' => 25]);
        $User->create(['id' => 'test:user:3', 'name' => 'Charlie', 'email' => 'charlie@example.com', 'age' => 35]);

        $results = $User->query()
            ->filter('age', 'gte', 30)
            ->exec();

        $this->assertGreaterThanOrEqual(2, count($results));

        foreach ($results as $user) {
            $this->assertGreaterThanOrEqual(30, $user['age']);
        }
    }

    public function testQueryWithSort()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $User->create(['id' => 'test:user:1', 'name' => 'Alice', 'email' => 'alice@example.com', 'age' => 30]);
        $User->create(['id' => 'test:user:2', 'name' => 'Bob', 'email' => 'bob@example.com', 'age' => 25]);
        $User->create(['id' => 'test:user:3', 'name' => 'Charlie', 'email' => 'charlie@example.com', 'age' => 35]);

        $results = $User->query()
            ->sort('age', 'asc')
            ->exec();

        $this->assertEquals('Bob', $results[0]['name']);
        $this->assertEquals('Charlie', $results[count($results) - 1]['name']);
    }

    public function testQueryWithLimit()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer']
        ]);

        $User->deleteMany();

        $User->create(['id' => 'test:user:1', 'name' => 'Alice', 'email' => 'alice@example.com', 'age' => 30]);
        $User->create(['id' => 'test:user:2', 'name' => 'Bob', 'email' => 'bob@example.com', 'age' => 25]);
        $User->create(['id' => 'test:user:3', 'name' => 'Charlie', 'email' => 'charlie@example.com', 'age' => 35]);

        $results = $User->query()
            ->limit(2)
            ->exec();

        $this->assertCount(2, $results);
    }

    public function testValidationRequired()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true, 'email' => true],
            'age' => ['type' => 'integer', 'required' => true]
        ]);

        $this->expectException(\Exception::class);
        $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'age' => 30
            // Missing required email
        ]);
    }

    public function testValidationEmail()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true, 'email' => true],
            'age' => ['type' => 'integer']
        ]);

        $this->expectException(\Exception::class);
        $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'invalid-email',
            'age' => 30
        ]);
    }

    public function testValidationMinMax()
    {
        $User = $this->torm->model('TestUser', [
            'name' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true],
            'age' => ['type' => 'integer', 'required' => true, 'min' => 13, 'max' => 120]
        ]);

        $this->expectException(\Exception::class);
        $User->create([
            'id' => 'test:user:1',
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'age' => 12  // Too young
        ]);
    }

    public function testProductModel()
    {
        $Product = $this->torm->model('TestProduct', [
            'name' => ['type' => 'string', 'required' => true],
            'price' => ['type' => 'float', 'required' => true, 'min' => 0],
            'stock' => ['type' => 'integer', 'required' => true, 'min' => 0],
            'sku' => ['type' => 'string', 'required' => true, 'pattern' => '/^[A-Z]{3}-\d{5}$/']
        ]);

        $Product->deleteMany();

        $product = $Product->create([
            'id' => 'test:product:1',
            'name' => 'Laptop',
            'price' => 999.99,
            'stock' => 10,
            'sku' => 'LAP-12345'
        ]);

        $this->assertEquals('LAP-12345', $product['sku']);
        $this->assertEquals(999.99, $product['price']);
        $this->assertEquals(10, $product['stock']);
    }
}
