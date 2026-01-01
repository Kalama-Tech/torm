<?php

namespace ToonStore\Torm;

use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Exception\RequestException;

/**
 * TORM Client for connecting to ToonStore
 */
class Client
{
    private HttpClient $httpClient;
    private string $baseURL;

    public function __construct(string $baseURL = 'http://localhost:3001')
    {
        $this->baseURL = rtrim($baseURL, '/');
        $this->httpClient = new HttpClient([
            'base_uri' => $this->baseURL,
            'timeout' => 30.0,
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function get(string $path): array
    {
        try {
            $response = $this->httpClient->get($path);
            return json_decode($response->getBody()->getContents(), true);
        } catch (RequestException $e) {
            throw new \RuntimeException('Request failed: ' . $e->getMessage());
        }
    }

    public function post(string $path, array $data): array
    {
        try {
            $response = $this->httpClient->post($path, ['json' => $data]);
            return json_decode($response->getBody()->getContents(), true);
        } catch (RequestException $e) {
            throw new \RuntimeException('Request failed: ' . $e->getMessage());
        }
    }

    public function put(string $path, array $data): array
    {
        try {
            $response = $this->httpClient->put($path, ['json' => $data]);
            return json_decode($response->getBody()->getContents(), true);
        } catch (RequestException $e) {
            throw new \RuntimeException('Request failed: ' . $e->getMessage());
        }
    }

    public function delete(string $path): array
    {
        try {
            $response = $this->httpClient->delete($path);
            return json_decode($response->getBody()->getContents(), true);
        } catch (RequestException $e) {
            throw new \RuntimeException('Request failed: ' . $e->getMessage());
        }
    }
}

/**
 * Base Model class
 */
abstract class Model
{
    protected static ?Client $client = null;
    protected static string $collection = '';
    protected array $data = [];

    public function __construct(array $data = [])
    {
        $this->data = $data;
    }

    public static function setClient(Client $client): void
    {
        static::$client = $client;
    }

    public static function setCollection(string $collection): void
    {
        static::$collection = $collection;
    }

    public static function create(array $data): static
    {
        if (static::$client === null) {
            throw new \RuntimeException('Client not set. Call Model::setClient() first');
        }

        $response = static::$client->post('/api/' . static::$collection, ['data' => $data]);
        return new static($response['data'] ?? $data);
    }

    public function save(): static
    {
        if (static::$client === null) {
            throw new \RuntimeException('Client not set. Call Model::setClient() first');
        }

        if (isset($this->data['id']) && !empty($this->data['id'])) {
            // Update existing
            static::$client->put(
                '/api/' . static::$collection . '/' . $this->data['id'],
                ['data' => $this->data]
            );
        } else {
            // Create new
            $response = static::$client->post('/api/' . static::$collection, ['data' => $this->data]);
            if (isset($response['id'])) {
                $this->data['id'] = $response['id'];
            }
        }

        return $this;
    }

    public static function findById(string $id): ?static
    {
        if (static::$client === null) {
            throw new \RuntimeException('Client not set. Call Model::setClient() first');
        }

        try {
            $data = static::$client->get('/api/' . static::$collection . '/' . $id);
            return new static($data);
        } catch (\RuntimeException $e) {
            if (str_contains($e->getMessage(), '404')) {
                return null;
            }
            throw $e;
        }
    }

    public static function find(?array $filters = null): array
    {
        if (static::$client === null) {
            throw new \RuntimeException('Client not set. Call Model::setClient() first');
        }

        if ($filters !== null) {
            $result = static::$client->post('/api/' . static::$collection . '/query', ['filters' => $filters]);
        } else {
            $result = static::$client->get('/api/' . static::$collection);
        }

        $models = [];
        foreach ($result['documents'] ?? [] as $doc) {
            $models[] = new static($doc);
        }

        return $models;
    }

    public static function count(): int
    {
        if (static::$client === null) {
            throw new \RuntimeException('Client not set. Call Model::setClient() first');
        }

        $result = static::$client->get('/api/' . static::$collection . '/count');
        return $result['count'] ?? 0;
    }

    public function delete(): bool
    {
        if (static::$client === null) {
            throw new \RuntimeException('Client not set. Call Model::setClient() first');
        }

        if (!isset($this->data['id']) || empty($this->data['id'])) {
            return false;
        }

        $result = static::$client->delete('/api/' . static::$collection . '/' . $this->data['id']);
        return $result['success'] ?? false;
    }

    public function toArray(): array
    {
        return $this->data;
    }

    public function get(string $key): mixed
    {
        return $this->data[$key] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $this->data[$key] = $value;
    }

    public function __get(string $name): mixed
    {
        return $this->get($name);
    }

    public function __set(string $name, mixed $value): void
    {
        $this->set($name, $value);
    }
}

/**
 * Migration definition
 */
class Migration
{
    public function __construct(
        public string $id,
        public string $name,
        public \Closure $up,
        public \Closure $down
    ) {
    }
}

/**
 * Migration Manager
 */
class MigrationManager
{
    private Client $client;
    /** @var Migration[] */
    private array $migrations = [];

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function addMigration(Migration $migration): void
    {
        $this->migrations[] = $migration;
    }

    public function migrate(): array
    {
        $applied = $this->getAppliedMigrations();
        $newlyApplied = [];

        foreach ($this->migrations as $migration) {
            if (!isset($applied[$migration->id])) {
                // Run migration
                ($migration->up)($this->client);

                // Record migration
                $this->saveMigration([
                    'id' => $migration->id,
                    'name' => $migration->name,
                    'applied_at' => date('c'),
                ]);

                $newlyApplied[] = $migration->name;
            }
        }

        return $newlyApplied;
    }

    public function rollback(int $steps = 1): array
    {
        $applied = $this->getAppliedMigrations();
        $rolledBack = [];

        // Sort by applied_at descending
        uasort($applied, function ($a, $b) {
            return strcmp($b['applied_at'], $a['applied_at']);
        });

        $count = 0;
        foreach ($applied as $id => $record) {
            if ($count >= $steps) {
                break;
            }

            // Find migration
            $migration = null;
            foreach ($this->migrations as $m) {
                if ($m->id === $id) {
                    $migration = $m;
                    break;
                }
            }

            if ($migration !== null) {
                // Run down migration
                ($migration->down)($this->client);

                // Remove migration record
                $this->removeMigration($id);
                $rolledBack[] = $record['name'];
                $count++;
            }
        }

        return $rolledBack;
    }

    public function status(): array
    {
        $applied = $this->getAppliedMigrations();
        $status = [];

        foreach ($this->migrations as $migration) {
            if (isset($applied[$migration->id])) {
                $record = $applied[$migration->id];
                $status[$migration->id] = "Applied ({$record['applied_at']})";
            } else {
                $status[$migration->id] = 'Pending';
            }
        }

        return $status;
    }

    private function getAppliedMigrations(): array
    {
        try {
            $response = $this->client->get('/api/keys/torm:migrations');
            return json_decode($response['value'] ?? '{}', true);
        } catch (\Exception $e) {
            return [];
        }
    }

    private function saveMigration(array $migration): void
    {
        $migrations = $this->getAppliedMigrations();
        $migrations[$migration['id']] = $migration;

        $this->client->put('/api/keys/torm:migrations', [
            'value' => json_encode($migrations),
        ]);
    }

    private function removeMigration(string $migrationId): void
    {
        $migrations = $this->getAppliedMigrations();
        unset($migrations[$migrationId]);

        $this->client->put('/api/keys/torm:migrations', [
            'value' => json_encode($migrations),
        ]);
    }
}

/**
 * Validation Exception
 */
class ValidationException extends \Exception
{
}
