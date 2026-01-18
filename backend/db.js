const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 🔌 FINAL SOLUTION: Transaction Pooler (Port 6543)
// This uses Supabase's IPv4 Pooler to bypass Render's IPv6 issues
let connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    // Safety mask for password
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Full Connection String: ${safeConnString}`);

    if (connectionString.includes('6543')) {
        console.log("✅ Using Transaction Pooler (Port 6543)");
    } else if (connectionString.includes('pooler.supabase.com')) {
        console.log("⚠️ Pooler URL detected but port might not be 6543. Check configuration.");
    } else {
        console.warn("⚠️ WARNING: Should be using Port 6543 for Render compatibility");
    }
} else {
    console.error("❌ No DATABASE_URL found!");
}

// 🛡️ Optimized Pool Config for Transaction Pooler
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        // 🔥 STABILITY SETTINGS FOR FREE TIER (Pooler)
        max: 2, // Keep concurrency very low to avoid rejection
        min: 0, // Don't hold idle connections
        idleTimeoutMillis: 5000, // Close idle connections FAST (5s) to avoid "terminated" errors
        connectionTimeoutMillis: 10000, // Fail fast (10s) so retry logic works
        allowExitOnIdle: true, // Allow Node to exit if pool is empty
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        // Fallback for local dev
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };

// Create the pool
const pool = new Pool(poolConfig);

// Global Error Handler
pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err.message);
});

pool.on('connect', () => {
    console.log('🔌 New client connected to pool');
});

/* -------------------------------------------------------------------------- */
/*                               Helper Functions                             */
/* -------------------------------------------------------------------------- */

async function query(text, params) {
    // Simplified Retry Logic for Pooler
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            lastError = err;

            // Non-retryable errors
            if (!err.message.includes('timeout') &&
                !err.message.includes('connection') &&
                !err.message.includes('ETIMEDOUT') &&
                !err.message.includes('ECONNRESET')) {
                throw err;
            }

            if (i < maxRetries - 1) {
                const delay = 1000 * Math.pow(2, i); // Faster retry for pooler
                console.warn(`⚠️ Query failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    console.error(`❌ Query failed after ${maxRetries} attempts:`, lastError.message);
    throw lastError;
}

async function getClient() {
    return await pool.connect();
}

async function testConnection() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ DB Connection Test Passed:', res.rows[0].now);
        return true;
    } catch (err) {
        console.error('❌ DB Connection Test Failed:', err.message);
        return false;
    }
}

module.exports = {
    query,
    getClient,
    testConnection,
    getPool: () => pool
};
