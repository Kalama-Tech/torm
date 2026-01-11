package torm_test

import (
	"os"
	"testing"

	"github.com/toonstore/torm-go"
)

var (
	testClient *torm.Client
	testURL    string
)

func TestMain(m *testing.M) {
	testURL = os.Getenv("TORM_URL")
	if testURL == "" {
		testURL = "http://localhost:3001"
	}
	testClient = torm.NewClient(testURL)
	os.Exit(m.Run())
}

// TestUser is a test model
type TestUser struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Age     int    `json:"age"`
	Website string `json:"website,omitempty"`
}

func (u *TestUser) GetID() string {
	return u.ID
}

func (u *TestUser) SetID(id string) {
	u.ID = id
}

func (u *TestUser) ToMap() map[string]interface{} {
	m := map[string]interface{}{
		"id":    u.ID,
		"name":  u.Name,
		"email": u.Email,
		"age":   u.Age,
	}
	if u.Website != "" {
		m["website"] = u.Website
	}
	return m
}

// TestProduct is a test model
type TestProduct struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
	SKU   string  `json:"sku"`
}

func (p *TestProduct) GetID() string {
	return p.ID
}

func (p *TestProduct) SetID(id string) {
	p.ID = id
}

func (p *TestProduct) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"id":    p.ID,
		"name":  p.Name,
		"price": p.Price,
		"stock": p.Stock,
		"sku":   p.SKU,
	}
}

func TestClientCreation(t *testing.T) {
	client := torm.NewClient(testURL)
	if client == nil {
		t.Fatal("Failed to create client")
	}
}

func TestCreateDocument(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	user := &TestUser{
		ID:    "test:user:1",
		Name:  "Alice",
		Email: "alice@example.com",
		Age:   30,
	}

	created, err := users.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	if created.GetID() != "test:user:1" {
		t.Errorf("Expected ID test:user:1, got %s", created.GetID())
	}
	if created.Name != "Alice" {
		t.Errorf("Expected name Alice, got %s", created.Name)
	}
}

func TestFindByID(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	// Create user first
	user := &TestUser{
		ID:    "test:user:2",
		Name:  "Bob",
		Email: "bob@example.com",
		Age:   25,
	}
	_, err := users.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Find by ID
	found, err := users.FindByID("test:user:2")
	if err != nil {
		t.Fatalf("Failed to find user: %v", err)
	}

	if found.Name != "Bob" {
		t.Errorf("Expected name Bob, got %s", found.Name)
	}
}

func TestFindAll(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	// Create multiple users
	users.Create(&TestUser{ID: "test:user:3", Name: "Charlie", Email: "charlie@example.com", Age: 35})
	users.Create(&TestUser{ID: "test:user:4", Name: "Diana", Email: "diana@example.com", Age: 28})

	// Find all
	all, err := users.Find()
	if err != nil {
		t.Fatalf("Failed to find all users: %v", err)
	}

	if len(all) < 2 {
		t.Errorf("Expected at least 2 users, got %d", len(all))
	}
}

func TestUpdateDocument(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	// Create user
	user := &TestUser{
		ID:    "test:user:5",
		Name:  "Eve",
		Email: "eve@example.com",
		Age:   30,
	}
	created, err := users.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Update user
	created.Age = 31
	updated, err := users.Update(created.GetID(), created)
	if err != nil {
		t.Fatalf("Failed to update user: %v", err)
	}

	if updated.Age != 31 {
		t.Errorf("Expected age 31, got %d", updated.Age)
	}
}

func TestDeleteDocument(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	// Create user
	user := &TestUser{
		ID:    "test:user:6",
		Name:  "Frank",
		Email: "frank@example.com",
		Age:   40,
	}
	created, err := users.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Delete user
	err = users.Delete(created.GetID())
	if err != nil {
		t.Fatalf("Failed to delete user: %v", err)
	}

	// Verify deletion
	_, err = users.FindByID(created.GetID())
	if err == nil {
		t.Error("Expected error when finding deleted user, got nil")
	}
}

func TestQueryWithFilter(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	// Create test data
	users.Create(&TestUser{ID: "test:user:7", Name: "George", Email: "george@example.com", Age: 25})
	users.Create(&TestUser{ID: "test:user:8", Name: "Hannah", Email: "hannah@example.com", Age: 35})

	// Query users older than 30
	query := map[string]interface{}{
		"filters": []map[string]interface{}{
			{
				"field":    "age",
				"operator": "gt",
				"value":    30,
			},
		},
	}

	results, err := users.Query(query)
	if err != nil {
		t.Fatalf("Failed to query users: %v", err)
	}

	if len(results) < 1 {
		t.Error("Expected at least 1 user with age > 30")
	}

	for _, user := range results {
		if user.Age <= 30 {
			t.Errorf("Expected age > 30, got %d", user.Age)
		}
	}
}

func TestCount(t *testing.T) {
	users := torm.NewCollection(testClient, "testusers", func() *TestUser { return &TestUser{} })

	count, err := users.Count()
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}

	if count < 0 {
		t.Errorf("Expected non-negative count, got %d", count)
	}
}

func TestProductModel(t *testing.T) {
	products := torm.NewCollection(testClient, "testproducts", func() *TestProduct { return &TestProduct{} })

	product := &TestProduct{
		ID:    "test:product:1",
		Name:  "Laptop",
		Price: 999.99,
		Stock: 10,
		SKU:   "LAP-12345",
	}

	created, err := products.Create(product)
	if err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	if created.SKU != "LAP-12345" {
		t.Errorf("Expected SKU LAP-12345, got %s", created.SKU)
	}

	if created.Price != 999.99 {
		t.Errorf("Expected price 999.99, got %f", created.Price)
	}
}
