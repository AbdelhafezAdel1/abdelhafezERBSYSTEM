const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 🔌 DATABASE CONNECTION CONFIG
// Priority: Use DATABASE_URL if available, otherwise build from individual vars
let connectionString = process.env.DATABASE_URL;

// If no DATABASE_URL, build it from parts
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
console.log(`   Target: ${safeConnString}`);

// Check if using pooler (recommended for Render free tier)
if (connectionString.includes('pooler') || connectionString.includes('6543')) {
    console.log("✅ Using Supabase Pooler (Transaction Mode - Recommended for Render)");
} else if (connectionString.includes('5432')) {
    console.log("⚠️ Using Direct Connection (Port 5432). If issues occur, try Pooler on port 6543");
}

// 🛡️ Pool Config optimized for Render + Supabase Pooler
const poolConfig = {
    connectionString: connectionString,
    max: 3,                         // Slightly higher for pooler
    min: 1,                         // Keep 1 connection alive
    idleTimeoutMillis: 10000,        // 10s - Shorter for pooler
    connectionTimeoutMillis: 10000,  // 10s - Faster timeout
    query_timeout: 15000,            // 15s query timeout
    statement_timeout: 15000,        // 15s statement timeout
    allowExitOnIdle: false,         // Keep pool alive
    ssl: {
        rejectUnauthorized: false
    },
    // Pooler specific settings
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('❌ DB Pool Error:', err.message);
});

pool.on('connect', () => {
    console.log('🔌 DB Connected successfully');
});

// Helper Functions with better error handling and exponential backoff
async function query(text, params = []) {
    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const start = Date.now();
            const result = await pool.query(text, params);
            const duration = Date.now() - start;
            
            // Log slow queries
            if (duration > 1000) {
                console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 100)}...`);
            }
            
            return result;
        } catch (err) {
            lastError = err;

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
                const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`⚠️ Retry ${attempt}/${maxRetries} in ${backoffTime}ms due to: ${err.message}`);
                await new Promise(r => setTimeout(r, backoffTime));
                continue;
            }

            // Log detailed error for debugging
            console.error('❌ Database Query Error:', {
                message: err.message,
                code: err.code,
                detail: err.detail,
                hint: err.hint,
                query: text.substring(0, 100),
                params: params.length > 0 ? '[PARAMS_REDACTED]' : '[]'
            });

            throw err;
        }
    }

    throw lastError;
}

async function getClient() {
    return await pool.connect();
}

async function testConnection() {
    try {
        console.log('🔍 Testing database connection...');
        const start = Date.now();
        
        const result = await pool.query('SELECT 1 as test, NOW() as server_time, version() as version');
        const duration = Date.now() - start;
        
        console.log('✅ DB Connection Verified');
        console.log(`   Response time: ${duration}ms`);
        console.log(`   Server time: ${result.rows[0].server_time}`);
        console.log(`   Version: ${result.rows[0].version.split(' ')[0]}`);
        
        return true;
    } catch (err) {
        console.error('❌ DB Connection Failed:', err.message);
        console.error('💡 Troubleshooting steps:');
        console.error('   1. Check if Supabase project is active');
        console.error('   2. Verify DATABASE_URL is correct');
        console.error('   3. Try using pooler URL (port 6543) instead of direct (port 5432)');
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

module.exports = {
    query,
    getClient,
    testConnection,
    getPool: () => pool
};
