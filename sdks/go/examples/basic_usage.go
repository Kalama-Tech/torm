package main

import (
	"fmt"
	"log"
	
	torm "github.com/toonstore/torm-go"
)

func main() {
	fmt.Println("🚀 TORM Go SDK - Basic Usage Example\n")
	
	// 1. Connect to TORM server
	fmt.Println("Connecting to TORM server...")
	client := torm.NewClient(&torm.ClientOptions{
		BaseURL: "http://localhost:3001",
	})
	
	// Check health
	health, err := client.Health()
	if err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	fmt.Printf("✅ Connected! Status: %v\n\n", health["status"])
	
	// 2. Define User model with validation
	fmt.Println("Defining User model...")
	User := client.Model("User", map[string]torm.ValidationRule{
		"name": {
			Type:      "string",
			Required:  true,
			MinLength: torm.IntPtr(3),
		},
		"email": {
			Type:     "string",
			Required: true,
			Email:    true,
		},
		"age": {
			Type: "int",
			Min:  torm.Float64Ptr(13),
			Max:  torm.Float64Ptr(120),
		},
		"active": {
			Type: "bool",
		},
	})
	fmt.Println("✅ User model defined\n")
	
	// 3. Create users
	fmt.Println("Creating users...")
	
	alice, err := User.Create(map[string]interface{}{
		"id":     "user:alice",
		"name":   "Alice Smith",
		"email":  "alice@example.com",
		"age":    30,
		"active": true,
	})
	if err != nil {
		log.Printf("❌ Failed to create Alice: %v", err)
	} else {
		fmt.Printf("✅ Created: %v\n", alice["name"])
	}
	
	bob, err := User.Create(map[string]interface{}{
		"id":     "user:bob",
		"name":   "Bob Johnson",
		"email":  "bob@example.com",
		"age":    25,
		"active": true,
	})
	if err != nil {
		log.Printf("❌ Failed to create Bob: %v", err)
	} else {
		fmt.Printf("✅ Created: %v\n", bob["name"])
	}
	
	charlie, err := User.Create(map[string]interface{}{
		"id":     "user:charlie",
		"name":   "Charlie Brown",
		"email":  "charlie@example.com",
		"age":    35,
		"active": false,
	})
	if err != nil {
		log.Printf("❌ Failed to create Charlie: %v\n", err)
	} else {
		fmt.Printf("✅ Created: %v\n\n", charlie["name"])
	}
	
	// 4. Find all users
	fmt.Println("Finding all users...")
	allUsers, err := User.Find()
	if err != nil {
		log.Printf("❌ Failed to find users: %v\n", err)
	} else {
		fmt.Printf("✅ Found %d users\n", len(allUsers))
		for _, user := range allUsers {
			fmt.Printf("   - %v (%v)\n", user["name"], user["email"])
		}
		fmt.Println()
	}
	
	// 5. Find user by ID
	fmt.Println("Finding user by ID...")
	user, err := User.FindByID("user:alice")
	if err != nil {
		log.Printf("❌ Failed to find user: %v\n", err)
	} else if user != nil {
		fmt.Printf("✅ Found: %v\n\n", user["name"])
	} else {
		fmt.Println("❌ User not found\n")
	}
	
	// 6. Query with filters
	fmt.Println("Querying active users over 25...")
	results, err := User.Query().
		Filter("active", torm.Eq, true).
		Filter("age", torm.Gte, 25).
		Sort("age", torm.Asc).
		Exec()
	
	if err != nil {
		log.Printf("❌ Query failed: %v\n", err)
	} else {
		fmt.Printf("✅ Found %d matching users:\n", len(results))
		for _, user := range results {
			fmt.Printf("   - %v, age %v\n", user["name"], user["age"])
		}
		fmt.Println()
	}
	
	// 7. Update user
	fmt.Println("Updating user...")
	updated, err := User.Update("user:bob", map[string]interface{}{
		"age": 26,
	})
	if err != nil {
		log.Printf("❌ Failed to update user: %v\n", err)
	} else {
		fmt.Printf("✅ Updated: %v, new age: %v\n\n", updated["name"], updated["age"])
	}
	
	// 8. Count users
	fmt.Println("Counting users...")
	count, err := User.Count()
	if err != nil {
		log.Printf("❌ Failed to count users: %v\n", err)
	} else {
		fmt.Printf("✅ Total users: %d\n\n", count)
	}
	
	// 9. Validation demo
	fmt.Println("Testing validation...")
	_, err = User.Create(map[string]interface{}{
		"id":    "user:invalid",
		"name":  "Invalid User",
		"email": "not-an-email",
		"age":   30,
	})
	if err != nil {
		fmt.Printf("✅ Validation caught error: %v\n\n", err)
	} else {
		fmt.Println("❌ Validation didn't catch invalid email\n")
	}
	
	// 10. Delete user
	fmt.Println("Deleting user...")
	success, err := User.Delete("user:charlie")
	if err != nil {
		log.Printf("❌ Failed to delete user: %v\n", err)
	} else if success {
		fmt.Println("✅ User deleted successfully\n")
	} else {
		fmt.Println("❌ Failed to delete user\n")
	}
	
	// 11. Verify deletion
	fmt.Println("Verifying deletion...")
	user, err = User.FindByID("user:charlie")
	if err != nil {
		log.Printf("❌ Failed to verify: %v\n", err)
	} else if user == nil {
		fmt.Println("✅ User successfully deleted\n")
	} else {
		fmt.Println("❌ User still exists\n")
	}
	
	fmt.Println("🎉 Example completed!")
}
