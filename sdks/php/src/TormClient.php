<?php

namespace Toonstore\Torm;

use Exception;

/**
 * ToonStore ORM Client
 * 
 * A Mongoose-style ORM client for ToonStore database
 */
class TormClient
{
    private string $baseUrl;
    private int $timeout;
    
    /**
     * Create a new TormClient instance
     * 
     * @param string $baseUrl Base URL of TORM server
     * @param int $timeout Request timeout in seconds
     */
    public function __construct(string $baseUrl = 'http://localhost:3001', int $timeout = 5)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }
    
    /**
     * Create a new model
     * 
     * @param string $name Model name
     * @param array $schema Validation schema
     * @param string|null $collection Collection name (defaults to lowercase model name)
     * @param bool $validate Enable validation
     * @return Model
     */
    public function model(string $name, array $schema = [], ?string $collection = null, bool $validate = true): Model
    {
        return new Model($this, $name, $schema, $collection, $validate);
    }
    
    /**
     * Check server health
     * 
     * @return array
     * @throws Exception
     */
    public function health(): array
    {
        return $this->request('GET', '/health');
    }
    
    /**
     * Get server info
     * 
     * @return array
     * @throws Exception
     */
    public function info(): array
    {
        return $this->request('GET', '/');
    }
    
    /**
     * Make HTTP request
     * 
     * @param string $method HTTP method
     * @param string $path Request path
     * @param array|null $data Request body
     * @return array
     * @throws Exception
     */
    public function request(string $method, string $path, ?array $data = null): array
    {
        $url = $this->baseUrl . $path;
        
        $options = [
            'http' => [
                'method' => $method,
                'header' => 'Content-Type: application/json',
                'timeout' => $this->timeout,
                'ignore_errors' => true,
            ],
        ];
        
        if ($data !== null) {
            $options['http']['content'] = json_encode($data);
        }
        
        $context = stream_context_create($options);
        $response = @file_get_contents($url, false, $context);
        
        if ($response === false) {
            throw new Exception("Request failed: Unable to connect to $url");
        }
        
        // Parse HTTP response code
        $statusCode = 200;
        if (isset($http_response_header[0])) {
            preg_match('/HTTP\/\d\.\d\s+(\d+)/', $http_response_header[0], $matches);
            if (isset($matches[1])) {
                $statusCode = (int)$matches[1];
            }
        }
        
        $result = json_decode($response, true);
        if ($result === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Failed to decode JSON response: " . json_last_error_msg());
        }
        
        if ($statusCode >= 400) {
            $message = $result['error'] ?? $result['message'] ?? 'Request failed';
            throw new Exception("Request failed with status $statusCode: $message");
        }
        
        return $result;
    }
    
    /**
     * Get base URL
     * 
     * @return string
     */
    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }
}
