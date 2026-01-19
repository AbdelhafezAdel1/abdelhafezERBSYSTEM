const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 🔌 DATABASE CONNECTION CONFIG
let connectionString = process.env.DATABASE_URL;
let fallbackConnectionString = process.env.DATABASE_URL_FALLBACK;
let enableFallback = String(process.env.ENABLE_DB_FALLBACK || '').toLowerCase() === 'true';

// Fallback logic for manual host/user/pass if DATABASE_URL is missing
if (!connectionString && process.env.DB_HOST) {
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || 5432;
    const database = process.env.DB_NAME || 'postgres';
    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

if (!connectionString) {
    console.error("❌ No database configuration found!");
    process.exit(1);
}

console.log('🔌 DB Config Check:');
console.log(`   Primary: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
if (enableFallback && fallbackConnectionString) {
    console.log(`   Fallback: ${fallbackConnectionString.replace(/:[^:@]+@/, ':***@')}`);
}

// 🛡️ Pool Config - SIMPLE & ROBUST
const poolConfig = {
    connectionString: connectionString,
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,       // 30s
    connectionTimeoutMillis: 30000, // 30s (Increased for Supabase Cold Starts)
    query_timeout: 30000,           // 30s
    statement_timeout: 30000,
    allowExitOnIdle: false,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
};

const pool = new Pool(poolConfig);

// Optional Fallback Pool
const fallbackPool = (enableFallback && fallbackConnectionString)
    ? new Pool({ ...poolConfig, connectionString: fallbackConnectionString, max: 2 })
    : null;

pool.on('error', (err) => console.error('❌ Primary DB Pool Error:', err.message));
pool.on('connect', () => console.log('🔌 Primary DB Connected'));

if (fallbackPool) {
    fallbackPool.on('error', (err) => console.error('❌ Fallback DB Pool Error:', err.message));
    fallbackPool.on('connect', () => console.log('🔌 Fallback DB Connected'));
}

// Helper Functions
async function query(text, params = []) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const start = Date.now();

            // 1. Try Primary Pool
            try {
                const result = await pool.query(text, params);
                const duration = Date.now() - start;
                if (duration > 1000) console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 50)}...`);
                return result;
            } catch (primaryErr) {
                // If not a connection error (e.g. constraints), throw immediately
                const isConnectionError = primaryErr.message.includes('timeout') ||
                    primaryErr.message.includes('connection') ||
                    primaryErr.code === 'ECONNREFUSED' ||
                    primaryErr.code === '57P01';

                if (!isConnectionError) throw primaryErr;

                console.log(`ℹ️ [Attempt ${attempt}/${maxRetries}] Database wake-up/retry... (${primaryErr.message})`);

                // 2. Try Fallback Pool (if enabled and connection error)
                if (fallbackPool) {
                    console.log(`🔌 Switching to Fallback Pool (Attempt ${attempt})...`);
                    const result = await fallbackPool.query(text, params);
                    console.log(`✅ Fallback Success`);
                    return result;
                } else {
                    throw primaryErr; // No fallback, throw to trigger retry loop
                }
            }

        } catch (err) {
            lastError = err;
            const isConnectionError = err.message.includes('timeout') || err.message.includes('connection');

            if (isConnectionError && attempt < maxRetries) {
                const delay = attempt * 2000; // 2s, 4s, 6s...
                console.log(`⏳ Connection timed out. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                // Final attempt failed or non-retryable error
                if (attempt === maxRetries) console.error(`❌ All DB attempts failed for: ${text.substring(0, 50)}`);
            }
        }
    }
    throw lastError;
}

async function getClient() {
    // Basic getClient - no fallback logic for transactions yet significantly 
    // Complexity warning: Transactions across pools are impossible. 
    // We stick to primary for transactions.
    return await pool.connect();
}

module.exports = {
    query,
    getClient,
    getPool: () => pool
};
