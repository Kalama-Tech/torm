/**
 * TORM Configuration
 * Define your ToonStoreDB connection here
 */

export default {
  // ToonStoreDB connection
  dbCredentials: {
    host: process.env.TOONSTORE_HOST || 'localhost',
    port: Number(process.env.TOONSTORE_PORT) || 6379,
    // For cloud/remote databases:
    // password: process.env.TOONSTORE_PASSWORD,
    // Or use a connection URL:
    // url: process.env.TOONSTORE_URL,
  },

  // Studio configuration
  studio: {
    port: 4983, // Default Studio port (like Drizzle)
    host: 'localhost',
  },
};
