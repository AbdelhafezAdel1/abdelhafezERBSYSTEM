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

// 🛡️ Pool Config - OPTIMIZED FOR STABILITY
const poolConfig = {
    connectionString: connectionString,
    max: 5,                 // Increased for better concurrency
    idleTimeoutMillis: 60000,  // 60s - keep connections alive longer
    connectionTimeoutMillis: 10000, // 10s - fail fast instead of waiting 60s
    statement_timeout: 30000,  // 30s query timeout
    ssl: { rejectUnauthorized: false }, // Required for Supabase
    keepAlive: true,        // 💓 CRITICAL: Prevents silent connection drops
    keepAliveInitialDelayMillis: 10000
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => console.error('❌ DB Pool Error:', err.message));
pool.on('connect', () => console.log('🔌 DB Connected'));

// Helper Functions
async function query(text, params = []) {
    return pool.query(text, params);
}

// 🛡️ Client Acquisition with Limited Retry
// Transactions need a dedicated client
async function getClient() {
    let attempts = 0;
    while (attempts < 2) {  // Reduced from 3 to 2 attempts
        try {
            attempts++;
            const client = await pool.connect();
            return client;
        } catch (err) {
            console.warn(`⚠️ getClient failed (Attempt ${attempts}/2): ${err.message}`);
            if (attempts === 2) throw err;
            await new Promise(res => setTimeout(res, 500));  // Shorter backoff: 500ms
        }
    }
}

module.exports = {
    query,
    getClient,
    getPool: () => pool
};
