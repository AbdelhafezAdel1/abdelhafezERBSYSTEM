const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 🔌 DATABASE CONNECTION CONFIG WITH FALLBACK
let connectionString = process.env.DATABASE_URL;
let fallbackConnectionString = process.env.DATABASE_URL_FALLBACK;
let enableFallback = String(process.env.ENABLE_DB_FALLBACK || '').toLowerCase() === 'true';

// 🤖 SMART FALLBACK A: Auto-detect Supabase Session Pooler (5432) -> Add Transaction Pooler (6543)
if (connectionString && connectionString.includes('pooler.supabase.com') && connectionString.includes(':5432')) {
    if (!fallbackConnectionString) {
        fallbackConnectionString = connectionString.replace(':5432', ':6543');
        console.log('🤖 Auto-configured Supabase Fallback to Port 6543 (Transaction Mode)');
        enableFallback = true;
    }
}

// Build fallback connection string (manually constructed case)
if (!connectionString && process.env.DB_HOST) {
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || 5432;
    const database = process.env.DB_NAME || 'postgres';

    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// Validate connection string
if (!connectionString) {
    console.error("❌ No database configuration found!");
    console.error("💡 Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME environment variables");
    process.exit(1);
}

console.log('🔌 DB Config Check:');
const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
console.log(`   Primary: ${safeConnString}`);

if (enableFallback && fallbackConnectionString) {
    const safeFallback = fallbackConnectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Fallback: ${safeFallback}`);
}

// Circuit breaker state
let circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: null,
    resetTimeout: 120000, // 2 minutes (increased)
    maxFailures: 5, // Increased threshold
    consecutiveSuccesses: 0,
    minSuccessesToClose: 3
};

// Check if circuit breaker should block requests
function checkCircuitBreaker() {
    if (circuitBreaker.isOpen) {
        const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
        if (timeSinceLastFailure > circuitBreaker.resetTimeout) {
            console.log('🔄 Circuit breaker reset - trying connection again');
            circuitBreaker.isOpen = false;
            circuitBreaker.failureCount = 0;
            circuitBreaker.consecutiveSuccesses = 0;
            return false;
        }
        return true; // Still open
    }
    return false; // Closed
}

// Record failure in circuit breaker
function recordFailure() {
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();
    circuitBreaker.consecutiveSuccesses = 0;

    if (circuitBreaker.failureCount >= circuitBreaker.maxFailures) {
        circuitBreaker.isOpen = true;
        console.error(`🚨 Circuit breaker OPENED after ${circuitBreaker.failureCount} failures - blocking database requests`);
    }
}

// Record success in circuit breaker
function recordSuccess() {
    circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
    circuitBreaker.consecutiveSuccesses++;

    if (circuitBreaker.isOpen && circuitBreaker.consecutiveSuccesses >= circuitBreaker.minSuccessesToClose) {
        console.log(`✅ Circuit breaker CLOSED after ${circuitBreaker.consecutiveSuccesses} consecutive successes`);
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
    }
}

// 🛡️ Pool Config optimized for Render + Supabase
const poolConfig = {
    connectionString: connectionString,
    max: 5,                         // Increased to 5 as requested
    min: 1,                         // Keep at least 1 connection open
    idleTimeoutMillis: 30000,       // 30s - Longer to keep connections alive
    connectionTimeoutMillis: 25000, // 25s - Very lenient for slow wake-ups
    query_timeout: 30000,           // 30s query timeout
    statement_timeout: 30000,       // 30s statement timeout
    allowExitOnIdle: false,
    ssl: {
        rejectUnauthorized: false
    },
    // Pooler specific settings
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
};

// Fallback pool config (direct connection)
const fallbackPoolConfig = {
    ...poolConfig,
    connectionString: fallbackConnectionString,
    max: 1,                         // Single connection for fallback
    min: 0,
    idleTimeoutMillis: 30000,        // Longer for direct
    connectionTimeoutMillis: 15000,   // Longer timeout for direct
};

const pool = new Pool(poolConfig);
const fallbackPool = enableFallback && fallbackConnectionString ? new Pool(fallbackPoolConfig) : null;

// Pool event handlers
pool.on('error', (err) => {
    console.error('❌ Primary DB Pool Error:', err.message);
    recordFailure();
});

pool.on('connect', () => {
    console.log('🔌 Primary DB Connected successfully');
    recordSuccess();
});

if (fallbackPool) {
    fallbackPool.on('error', (err) => {
        console.error('❌ Fallback DB Pool Error:', err.message);
    });

    fallbackPool.on('connect', () => {
        console.log('🔌 Fallback DB Connected successfully');
    });
}

// Helper Functions with fallback and circuit breaker
async function query(text, params = []) {
    // Check circuit breaker first
    if (checkCircuitBreaker()) {
        throw new Error('Circuit breaker is open - database temporarily unavailable');
    }

    const maxRetries = 3; // Reduced retries with fallback
    let lastError;
    let useFallback = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const currentPool = useFallback && fallbackPool ? fallbackPool : pool;

        try {
            const start = Date.now();
            const result = await currentPool.query(text, params);
            const duration = Date.now() - start;

            // Log slow queries
            if (duration > 1000) {
                console.warn(`⚠️ Slow query (${duration}ms) on ${useFallback ? 'fallback' : 'primary'}: ${text.substring(0, 100)}...`);
            }

            // Success on primary - record success and return
            if (!useFallback) {
                recordSuccess();
            }

            return result;

        } catch (err) {
            lastError = err;

            // If primary fails and we have fallback, switch to fallback
            if (!useFallback && fallbackPool && attempt === 2) {
                console.warn('🔄 Primary connection failed, switching to fallback...');
                useFallback = true;
                continue;
            }

            // Retry on timeout/connection errors with exponential backoff
            if (attempt < maxRetries && (
                err.message.includes('timeout') ||
                err.message.includes('ECONNREFUSED') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('connection') ||
                err.message.includes('terminated') ||
                err.code === 'ECONNRESET' ||
                err.code === '57P03' || // connection does not exist
                err.code === '08006'   // connection failure
            )) {
                const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
                console.log(`⚠️ Retry ${attempt}/${maxRetries} in ${backoffTime}ms on ${useFallback ? 'fallback' : 'primary'} due to: ${err.message}`);
                await new Promise(r => setTimeout(r, backoffTime));
                continue;
            }

            break; // Don't retry on other errors
        }
    }

    // Record failure if primary failed
    if (!useFallback) {
        recordFailure();
    }

    // Log detailed error for debugging
    console.error('❌ Database Query Error:', {
        message: lastError.message,
        code: lastError.code,
        detail: lastError.detail,
        hint: lastError.hint,
        pool: useFallback ? 'fallback' : 'primary',
        query: text.substring(0, 100),
        params: params.length > 0 ? '[PARAMS_REDACTED]' : '[]'
    });

    throw lastError;
}

async function getClient() {
    return await pool.connect();
}

async function testConnection() {
    const pools = [
        { name: 'Primary', pool: pool },
        { name: 'Fallback', pool: fallbackPool }
    ].filter(p => p.pool); // Filter out null fallback

    for (const { name, pool: currentPool } of pools) {
        try {
            console.log(`🔍 Testing ${name.toLowerCase()} database connection...`);
            const start = Date.now();

            const result = await currentPool.query('SELECT 1 as test, NOW() as server_time, version() as version');
            const duration = Date.now() - start;

            console.log(`✅ ${name} DB Connection Verified`);
            console.log(`   Response time: ${duration}ms`);
            console.log(`   Server time: ${result.rows[0].server_time}`);
            console.log(`   Version: ${result.rows[0].version.split(' ')[0]}`);

            return true;
        } catch (err) {
            console.error(`❌ ${name} DB Connection Failed:`, err.message);

            if (name === 'Primary' && fallbackPool) {
                console.log('🔄 Will try fallback connection...');
                continue;
            }

            console.error('💡 Troubleshooting steps:');
            console.error('   1. Check if Supabase project is active');
            console.error('   2. Verify DATABASE_URL is correct');
            console.error('   3. Try using direct connection (port 5432) instead of pooler (port 6543)');
            console.error('   4. Check network connectivity');
            console.error('   5. Verify SSL certificates');

            if (err.code === 'ECONNREFUSED') {
                console.error('   ❌ Connection refused - Check host and port');
            } else if (err.code === '28P01') {
                console.error('   ❌ Authentication failed - Check username/password');
            } else if (err.code === '3D000') {
                console.error('   ❌ Database does not exist - Check database name');
            }

            return false;
        }
    }

    return false;
}

module.exports = {
    query,
    getClient,
    testConnection,
    getPool: () => pool,
    getFallbackPool: () => fallbackPool,
    getCircuitBreakerState: () => ({ ...circuitBreaker })
};
