<?php

namespace Toonstore\Torm;

use Exception;

/**
 * Model class for database operations
 */
class Model
{
    private TormClient $client;
    private string $name;
    private string $collection;
    private array $schema;
    private bool $validate;
    
    /**
     * Create a new Model instance
     */
    public function __construct(TormClient $client, string $name, array $schema = [], ?string $collection = null, bool $validate = true)
    {
        $this->client = $client;
        $this->name = $name;
        $this->collection = $collection ?? strtolower($name);
        $this->schema = $schema;
        $this->validate = $validate;
    }
    
    /**
     * Create a new document
     * 
     * @param array $data Document data
     * @return array Created document
     * @throws Exception
     */
    public function create(array $data): array
    {
        if ($this->validate && !empty($this->schema)) {
            $this->validateData($data);
        }
        
        $response = $this->client->request('POST', "/api/{$this->collection}", ['data' => $data]);
        return $response['data'] ?? $response;
    }
    
    /**
     * Find all documents
     * 
     * @return array List of documents
     * @throws Exception
     */
    public function find(): array
    {
        $response = $this->client->request('GET', "/api/{$this->collection}");
        return $response['documents'] ?? [];
    }
    
    /**
     * Find document by ID
     * 
     * @param string $id Document ID
     * @return array|null Document or null if not found
     */
    public function findById(string $id): ?array
    {
        try {
            return $this->client->request('GET', "/api/{$this->collection}/{$id}");
        } catch (Exception $e) {
            if (strpos($e->getMessage(), '404') !== false) {
                return null;
            }
            throw $e;
        }
    }
    
    /**
     * Update document by ID
     * 
     * @param string $id Document ID
     * @param array $data Update data
     * @return array Updated document
     * @throws Exception
     */
    public function update(string $id, array $data): array
    {
        if ($this->validate && !empty($this->schema)) {
            $this->validateData($data, true);
        }
        
        $response = $this->client->request('PUT', "/api/{$this->collection}/{$id}", ['data' => $data]);
        return $response['data'] ?? $response;
    }
    
    /**
     * Delete document by ID
     * 
     * @param string $id Document ID
     * @return bool True if deleted successfully
     * @throws Exception
     */
    public function delete(string $id): bool
    {
        $response = $this->client->request('DELETE', "/api/{$this->collection}/{$id}");
        return $response['success'] ?? false;
    }
    
    /**
     * Count all documents
     * 
     * @return int Document count
     * @throws Exception
     */
    public function count(): int
    {
        $response = $this->client->request('GET', "/api/{$this->collection}/count");
        return $response['count'] ?? 0;
    }
    
    /**
     * Create a query builder
     * 
     * @return QueryBuilder
     */
    public function query(): QueryBuilder
    {
        return new QueryBuilder($this->client, $this->collection);
    }
    
    /**
     * Validate data against schema
     * 
     * @param array $data Data to validate
     * @param bool $partial Whether this is a partial update
     * @throws Exception
     */
    private function validateData(array $data, bool $partial = false): void
    {
        foreach ($this->schema as $field => $rules) {
            $value = $data[$field] ?? null;
            
            // Required check
            if (($rules['required'] ?? false) && !$partial && $value === null) {
                throw new Exception("Validation error: Field '$field' is required");
            }
            
            // Skip if value is null and not required
            if ($value === null) {
                continue;
            }
            
            // Type check
            if (isset($rules['type'])) {
                $this->checkType($field, $value, $rules['type']);
            }
            
            // String validations
            if (is_string($value)) {
                if (isset($rules['min_length']) && strlen($value) < $rules['min_length']) {
                    throw new Exception("Validation error: Field '$field' must be at least {$rules['min_length']} characters");
                }
                if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                    throw new Exception("Validation error: Field '$field' must be at most {$rules['max_length']} characters");
                }
                if (($rules['email'] ?? false) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    throw new Exception("Validation error: Field '$field' must be a valid email");
                }
                if (($rules['url'] ?? false) && !filter_var($value, FILTER_VALIDATE_URL)) {
                    throw new Exception("Validation error: Field '$field' must be a valid URL");
                }
                if (isset($rules['pattern']) && !preg_match($rules['pattern'], $value)) {
                    throw new Exception("Validation error: Field '$field' does not match pattern");
                }
            }
            
            // Number validations
            if (is_numeric($value)) {
                if (isset($rules['min']) && $value < $rules['min']) {
                    throw new Exception("Validation error: Field '$field' must be at least {$rules['min']}");
                }
                if (isset($rules['max']) && $value > $rules['max']) {
                    throw new Exception("Validation error: Field '$field' must be at most {$rules['max']}");
                }
            }
            
            // Custom validation
            if (isset($rules['validate']) && is_callable($rules['validate'])) {
                if (!$rules['validate']($value)) {
                    throw new Exception("Validation error: Field '$field' failed custom validation");
                }
            }
        }
    }
    
    /**
     * Check if value matches expected type
     * 
     * @param string $field Field name
     * @param mixed $value Field value
     * @param string $expectedType Expected type
     * @throws Exception
     */
    private function checkType(string $field, mixed $value, string $expectedType): void
    {
        $valid = match($expectedType) {
            'string' => is_string($value),
            'int', 'integer' => is_int($value),
            'float', 'double' => is_float($value),
            'bool', 'boolean' => is_bool($value),
            'array' => is_array($value),
            'object' => is_object($value),
            default => true,
        };
        
        if (!$valid) {
            throw new Exception("Validation error: Field '$field' must be of type $expectedType");
        }
    }
}
