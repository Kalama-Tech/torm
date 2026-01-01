//! Relationships example with TORM
//!
//! Demonstrates:
//! - One-to-one relationships (User -> Profile)
//! - One-to-many relationships (User -> Posts)
//! - Nested relationships (Post -> Comments)
//! - Manual population pattern

use serde::{Deserialize, Serialize};
use torm::{Model, Result, TormDb};

// User model
#[derive(Serialize, Deserialize, Debug, Clone)]
struct User {
    id: String,
    name: String,
    email: String,
}

impl torm::Model for User {
    fn collection() -> &'static str {
        "user"
    }

    fn id(&self) -> &str {
        &self.id
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

// Profile model (one-to-one with User)
#[derive(Serialize, Deserialize, Debug, Clone)]
struct Profile {
    id: String,
    user_id: String, // Reference to User
    bio: String,
    avatar_url: String,
}

impl torm::Model for Profile {
    fn collection() -> &'static str {
        "profile"
    }

    fn id(&self) -> &str {
        &self.id
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

// Post model (many-to-one with User)
#[derive(Serialize, Deserialize, Debug, Clone)]
struct Post {
    id: String,
    user_id: String, // Reference to User
    title: String,
    content: String,
}

impl torm::Model for Post {
    fn collection() -> &'static str {
        "post"
    }

    fn id(&self) -> &str {
        &self.id
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

// Comment model (many-to-one with Post)
#[derive(Serialize, Deserialize, Debug, Clone)]
struct Comment {
    id: String,
    post_id: String, // Reference to Post
    user_id: String, // Reference to User
    content: String,
}

impl torm::Model for Comment {
    fn collection() -> &'static str {
        "comment"
    }

    fn id(&self) -> &str {
        &self.id
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

// Populated models (with relationships loaded)
#[derive(Debug)]
struct UserWithProfile {
    user: User,
    profile: Option<Profile>,
}

#[derive(Debug)]
struct UserWithPosts {
    user: User,
    posts: Vec<Post>,
}

#[derive(Debug)]
struct PostWithComments {
    post: Post,
    comments: Vec<Comment>,
}

#[derive(Debug)]
struct PostWithAuthor {
    post: Post,
    author: Option<User>,
}

// Helper functions for relationships
async fn populate_user_profile(db: &TormDb, user: &User) -> Result<Option<Profile>> {
    // Find profile by user_id
    let profiles = Profile::find_all(db).await?;
    Ok(profiles.into_iter().find(|p| p.user_id == user.id))
}

async fn populate_user_posts(db: &TormDb, user: &User) -> Result<Vec<Post>> {
    // Find all posts by user_id
    let posts = Post::find_all(db).await?;
    Ok(posts.into_iter().filter(|p| p.user_id == user.id).collect())
}

async fn populate_post_comments(db: &TormDb, post: &Post) -> Result<Vec<Comment>> {
    // Find all comments by post_id
    let comments = Comment::find_all(db).await?;
    Ok(comments
        .into_iter()
        .filter(|c| c.post_id == post.id)
        .collect())
}

async fn populate_post_author(db: &TormDb, post: &Post) -> Result<Option<User>> {
    // Find user by id
    Ok(User::find_by_id(db, &post.user_id).await.ok())
}

#[tokio::main]
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    println!("🚀 TORM Relationships Example\n");

    // Connect to ToonStore
    println!("Connecting to ToonStore...");
    let db = TormDb::connect("redis://localhost:6379").await?;
    println!("✅ Connected!\n");

    // Create User
    println!("Creating user...");
    let user = User {
        id: "user:1".into(),
        name: "Alice".into(),
        email: "alice@example.com".into(),
    };
    user.save(&db).await?;
    println!("✅ User created: {}\n", user.name);

    // Create Profile (one-to-one)
    println!("Creating profile for user...");
    let profile = Profile {
        id: "profile:1".into(),
        user_id: "user:1".into(),
        bio: "Software engineer and blogger".into(),
        avatar_url: "https://example.com/avatar.jpg".into(),
    };
    profile.save(&db).await?;
    println!("✅ Profile created\n");

    // Create Posts (one-to-many)
    println!("Creating posts for user...");
    let posts = vec![
        Post {
            id: "post:1".into(),
            user_id: "user:1".into(),
            title: "First Post".into(),
            content: "This is my first blog post!".into(),
        },
        Post {
            id: "post:2".into(),
            user_id: "user:1".into(),
            title: "Second Post".into(),
            content: "Another great post about Rust.".into(),
        },
    ];

    for post in &posts {
        post.save(&db).await?;
        println!("  ✅ Post created: {}", post.title);
    }
    println!();

    // Create Comments (many-to-one with Post)
    println!("Creating comments on posts...");
    let comments = vec![
        Comment {
            id: "comment:1".into(),
            post_id: "post:1".into(),
            user_id: "user:1".into(),
            content: "Great first post!".into(),
        },
        Comment {
            id: "comment:2".into(),
            post_id: "post:1".into(),
            user_id: "user:1".into(),
            content: "Looking forward to more.".into(),
        },
        Comment {
            id: "comment:3".into(),
            post_id: "post:2".into(),
            user_id: "user:1".into(),
            content: "Rust is awesome!".into(),
        },
    ];

    for comment in &comments {
        comment.save(&db).await?;
        println!("  ✅ Comment created on post");
    }
    println!();

    // Example 1: Populate one-to-one relationship
    println!("Example 1: User with Profile (one-to-one)");
    let user_from_db = User::find_by_id(&db, "user:1").await?;
    let profile_opt = populate_user_profile(&db, &user_from_db).await?;

    let user_with_profile = UserWithProfile {
        user: user_from_db,
        profile: profile_opt,
    };

    println!("  User: {}", user_with_profile.user.name);
    if let Some(profile) = &user_with_profile.profile {
        println!("  Bio: {}", profile.bio);
    }
    println!();

    // Example 2: Populate one-to-many relationship
    println!("Example 2: User with Posts (one-to-many)");
    let user_from_db = User::find_by_id(&db, "user:1").await?;
    let user_posts = populate_user_posts(&db, &user_from_db).await?;

    let user_with_posts = UserWithPosts {
        user: user_from_db,
        posts: user_posts,
    };

    println!("  User: {}", user_with_posts.user.name);
    println!("  Posts:");
    for post in &user_with_posts.posts {
        println!("    - {}", post.title);
    }
    println!();

    // Example 3: Populate nested relationships
    println!("Example 3: Post with Comments (nested)");
    let post = Post::find_by_id(&db, "post:1").await?;
    let post_comments = populate_post_comments(&db, &post).await?;

    let post_with_comments = PostWithComments {
        post,
        comments: post_comments,
    };

    println!("  Post: {}", post_with_comments.post.title);
    println!("  Comments ({}):", post_with_comments.comments.len());
    for comment in &post_with_comments.comments {
        println!("    - {}", comment.content);
    }
    println!();

    // Example 4: Reverse relationship (Post -> User)
    println!("Example 4: Post with Author (reverse relationship)");
    let post = Post::find_by_id(&db, "post:2").await?;
    let author = populate_post_author(&db, &post).await?;

    let post_with_author = PostWithAuthor { post, author };

    println!("  Post: {}", post_with_author.post.title);
    if let Some(author) = &post_with_author.author {
        println!("  Author: {}", author.name);
    }
    println!();

    // Example 5: Cascade delete pattern
    println!("Example 5: Cascade delete (delete user and related data)");
    println!("  Deleting user's posts...");
    let user_posts = populate_user_posts(&db, &user).await?;
    for post in &user_posts {
        // Delete comments first
        let post_comments = populate_post_comments(&db, post).await?;
        for comment in &post_comments {
            comment.delete(&db).await?;
        }
        // Delete post
        post.delete(&db).await?;
    }

    println!("  Deleting user's profile...");
    if let Some(profile) = populate_user_profile(&db, &user).await? {
        profile.delete(&db).await?;
    }

    println!("  Deleting user...");
    user.delete(&db).await?;
    println!("✅ Cascade delete complete\n");

    // Verify deletion
    println!("Verifying deletion...");
    let user_exists = User::exists(&db, "user:1").await?;
    let post_count = Post::count(&db).await?;
    let comment_count = Comment::count(&db).await?;

    println!("  User exists: {}", user_exists);
    println!("  Remaining posts: {}", post_count);
    println!("  Remaining comments: {}", comment_count);
    println!();

    println!("🎉 Relationships example completed!");
    Ok(())
}
