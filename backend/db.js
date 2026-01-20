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

// 🛡️ Pool Config - STABLE & PATIENT
const poolConfig = {
    connectionString: connectionString,
    max: 10,                // Increased for better concurrency (was 5)
    idleTimeoutMillis: 30000,  // 30s idle timeout
    connectionTimeoutMillis: 120000, // 120s - VERY PATIENT for Supabase cold starts
    statement_timeout: 30000,  // 30s query timeout
    ssl: { rejectUnauthorized: false }, // Required for Supabase
    keepAlive: true,        // Prevents silent connection drops
    keepAliveInitialDelayMillis: 10000
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => console.error('❌ DB Pool Error:', err.message));
pool.on('connect', () => console.log('🔌 DB Connected'));

// Helper Functions
async function query(text, params = []) {
    return pool.query(text, params);
}

// 🛡️ Simple Client Acquisition - Trust the Pool
async function getClient() {
    return await pool.connect();  // Pool handles retry automatically
}

module.exports = {
    query,
    getClient,
    getPool: () => pool
};
