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
    connectionTimeoutMillis: 5000,  // 5s fail fast
    query_timeout: 10000,           // 10s query timeout (strictly enforcement)
    statement_timeout: 10000,
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
    let currentPool = pool;
    let poolName = 'primary';

    try {
        const start = Date.now();
        const result = await currentPool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 50)}...`);
        return result;
    } catch (err) {
        // Only try fallback if it's a connection error AND fallback is available
        const isConnectionError = err.message.includes('timeout') || err.message.includes('connection') || err.code === 'ECONNREFUSED';

        if (isConnectionError && fallbackPool) {
            console.warn(`🔄 Primary failed (${err.message}), trying fallback...`);
            try {
                return await fallbackPool.query(text, params);
            } catch (fallbackErr) {
                console.error(`❌ Fallback also failed: ${fallbackErr.message}`);
                throw fallbackErr; // Throw original or fallback error? Throw fallback.
            }
        }

        throw err;
    }
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
