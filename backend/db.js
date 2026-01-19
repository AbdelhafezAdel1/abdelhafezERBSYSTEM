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
    max: 3,                 // Low max connections for direct access
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000, // 60s patience for cold starts
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

// 🛡️ Robust Client Acquisition with Retry
// Transactions need a dedicated client, and this can fail on network blips.
async function getClient() {
    let attempts = 0;
    while (attempts < 3) {
        try {
            attempts++;
            const client = await pool.connect();
            return client;
        } catch (err) {
            console.warn(`⚠️ getClient failed (Attempt ${attempts}/3): ${err.message}`);
            if (attempts === 3) throw err;
            await new Promise(res => setTimeout(res, 1000 * attempts)); // Backoff: 1s, 2s
        }
    }
}

module.exports = {
    query,
    getClient,
    getPool: () => pool
};
