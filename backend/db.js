const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL (Render/Supabase) and individual env vars
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Supabase/Render
        }
    })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erb_system',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
    });

// Test connection on startup
pool.query('SELECT NOW()')
    .then(() => console.log('✓ Database connected successfully'))
    .catch(err => console.error('✗ Database connection error:', err.message));

module.exports = {
    query: (text, params) => pool.query(text, params),
};
