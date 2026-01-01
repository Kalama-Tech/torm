<?php

namespace Toonstore\Torm;

use Exception;

/**
 * Query builder for constructing complex queries
 */
class QueryBuilder
{
    private TormClient $client;
    private string $collection;
    private array $filters = [];
    private ?array $sort = null;
    private ?int $limit = null;
    private ?int $skip = null;
    
    /**
     * Create a new QueryBuilder instance
     */
    public function __construct(TormClient $client, string $collection)
    {
        $this->client = $client;
        $this->collection = $collection;
    }
    
    /**
     * Add a filter condition
     * 
     * @param string $field Field name
     * @param string $operator Comparison operator
     * @param mixed $value Comparison value
     * @return self
     */
    public function filter(string $field, string $operator, mixed $value): self
    {
        $this->filters[] = [
            'field' => $field,
            'operator' => $operator,
            'value' => $value,
        ];
        return $this;
    }
    
    /**
     * Add an equality filter (shorthand for filter with 'eq')
     * 
     * @param string $field Field name
     * @param mixed $value Expected value
     * @return self
     */
    public function where(string $field, mixed $value): self
    {
        return $this->filter($field, 'eq', $value);
    }
    
    /**
     * Sort results
     * 
     * @param string $field Field to sort by
     * @param string $order Sort order ('asc' or 'desc')
     * @return self
     */
    public function sort(string $field, string $order = 'asc'): self
    {
        $this->sort = [
            'field' => $field,
            'order' => $order,
        ];
        return $this;
    }
    
    /**
     * Limit number of results
     * 
     * @param int $n Maximum number of results
     * @return self
     */
    public function limit(int $n): self
    {
        $this->limit = $n;
        return $this;
    }
    
    /**
     * Skip number of results
     * 
     * @param int $n Number of results to skip
     * @return self
     */
    public function skip(int $n): self
    {
        $this->skip = $n;
        return $this;
    }
    
    /**
     * Execute the query
     * 
     * @return array List of matching documents
     * @throws Exception
     */
    public function exec(): array
    {
        $queryData = [];
        
        if (!empty($this->filters)) {
            $queryData['filters'] = $this->filters;
        }
        if ($this->sort !== null) {
            $queryData['sort'] = $this->sort;
        }
        if ($this->limit !== null) {
            $queryData['limit'] = $this->limit;
        }
        if ($this->skip !== null) {
            $queryData['skip'] = $this->skip;
        }
        
        $response = $this->client->request('POST', "/api/{$this->collection}/query", $queryData);
        $documents = $response['documents'] ?? [];
        
        // Apply client-side filtering
        if (!empty($this->filters)) {
            $documents = array_filter($documents, fn($doc) => $this->matchesFilters($doc));
        }
        
        // Apply client-side sorting
        if ($this->sort !== null) {
            usort($documents, function($a, $b) {
                $field = $this->sort['field'];
                $valA = $a[$field] ?? '';
                $valB = $b[$field] ?? '';
                
                $cmp = $valA <=> $valB;
                return $this->sort['order'] === 'desc' ? -$cmp : $cmp;
            });
        }
        
        return array_values($documents);
    }
    
    /**
     * Count matching documents
     * 
     * @return int Number of matching documents
     * @throws Exception
     */
    public function count(): int
    {
        return count($this->exec());
    }
    
    /**
     * Check if document matches all filters
     * 
     * @param array $doc Document to check
     * @return bool
     */
    private function matchesFilters(array $doc): bool
    {
        foreach ($this->filters as $filter) {
            $field = $filter['field'];
            $operator = $filter['operator'];
            $value = $filter['value'];
            $docValue = $doc[$field] ?? null;
            
            if (!$this->matchesFilter($docValue, $operator, $value)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Check if value matches filter
     * 
     * @param mixed $docValue Document value
     * @param string $operator Comparison operator
     * @param mixed $filterValue Filter value
     * @return bool
     */
    private function matchesFilter(mixed $docValue, string $operator, mixed $filterValue): bool
    {
        return match($operator) {
            'eq' => $docValue == $filterValue,
            'ne' => $docValue != $filterValue,
            'gt' => $docValue > $filterValue,
            'gte' => $docValue >= $filterValue,
            'lt' => $docValue < $filterValue,
            'lte' => $docValue <= $filterValue,
            'contains' => is_string($docValue) && str_contains($docValue, (string)$filterValue),
            'in' => is_array($filterValue) && in_array($docValue, $filterValue),
            'not_in' => is_array($filterValue) && !in_array($docValue, $filterValue),
            default => false,
        };
    }
}
