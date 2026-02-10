/**
 * Vitest setup: use mock DB for all tests to avoid SQLite native bindings.
 * Must run before any module that imports db.
 */
process.env.USE_MOCK_DB = '1';
