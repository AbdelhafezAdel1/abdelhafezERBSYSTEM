const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 🔌 DATABASE CONNECTION CONFIG
// Expecting DIRECT connection string (not pooler) in DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ No database configuration found! Please set DATABASE_URL.");
    process.exit(1);
}

console.log('🔌 DB Config Check:');
console.log(`   URL: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

// 🛡️ Pool Config - DIRECT CONNECTION OPTIMIZED
const poolConfig = {
    connectionString: connectionString,
    max: 3,                 // Low max connections for direct access to avoid exhausting Postgres limits
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000, // 60s patience for cold starts
    ssl: { rejectUnauthorized: false } // Required for Supabase
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => console.error('❌ DB Pool Error:', err.message));
pool.on('connect', () => console.log('🔌 DB Connected'));

// Helper Functions
async function query(text, params = []) {
    return pool.query(text, params);
}

async function getClient() {
    return await pool.connect();
}

module.exports = {
    query,
    getClient,
    getPool: () => pool
};
