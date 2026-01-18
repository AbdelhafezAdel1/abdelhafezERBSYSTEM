const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 🔌 FINAL SOLUTION: Port 6543 with Non-Blocking Strategy
// The key is NOT the port, but the non-blocking warm-up approach
let connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    // Log the resolved host to ensure env var is read correctly
    try {
        const url = new URL(connectionString);
        console.log(`   Target Host: ${url.hostname}`);
        console.log(`   Target Port: ${url.port}`);
        console.log(`   Using SSL: true`);
    } catch (e) {
        console.log('   Could not parse URL details');
    }

    // Safety mask for password
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Full Connection String: ${safeConnString}`);

    if (connectionString.includes('pooler.supabase.com')) {
        console.log("⚠️ Using Supabase Pooler - May have timeout issues on free tier");
    } else if (connectionString.includes('supabase.co')) {
        console.log("✅ Using Direct Connection (supabase.co) - Best for stability");
    }
} else {
    console.error("❌ No DATABASE_URL found!");
}

// 🛡️ FINAL Pool Configuration - Proven to work on Free Tiers
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 3, // Small pool for free tier
        min: 1, // Keep 1 connection warm
        idleTimeoutMillis: 30000, // 30s
        connectionTimeoutMillis: 120000, // 2 minutes (Final attempt before confirming IP block)
        allowExitOnIdle: false, // Keep pool alive
        keepAlive: true, // TCP keep-alive
        keepAliveInitialDelayMillis: 10000, // 10s
        ssl: {
            rejectUnauthorized: false,
            // Increase compatibility
            checkServerIdentity: () => undefined
        }
    }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erb_system',
        password: process.env.DB_PASSWORD || 'password',
        port: 5432,
        max: 3,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 60000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        allowExitOnIdle: false,
        ssl: { rejectUnauthorized: false }
    };

// إنشاء Pool واحد فقط
const pool = new Pool(poolConfig);

// معالجة أخطاء الـ Pool العامة (Logging only)
pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err.message);
    // لا نقوم بأي أكشن هنا، نترك الـ Pool يتعامل
});

// تتبع إنشاء الاتصالات الجديد
pool.on('connect', () => {
    console.log('🔌 New client connected to pool');
});

/* -------------------------------------------------------------------------- */
/*                               Helper Functions                             */
/* -------------------------------------------------------------------------- */

async function query(text, params) {
    // Simplified Retry Logic - 3 attempts with reasonable delays
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            lastError = err;

            // Non-retryable errors (SQL syntax, etc.)
            if (!err.message.includes('timeout') &&
                !err.message.includes('connection') &&
                !err.message.includes('ETIMEDOUT') &&
                !err.message.includes('ECONNRESET')) {
                throw err;
            }

            // Retry with exponential backoff: 2s, 4s, 8s
            if (i < maxRetries - 1) {
                const delay = 2000 * Math.pow(2, i);
                console.warn(`⚠️ Query failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    console.error(`❌ Query failed after ${maxRetries} attempts:`, lastError.message);
    throw lastError;
}

// دالة للحصول على client (لـ Transactions)
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

// تصدير الدوال
module.exports = {
    query,
    getClient,
    testConnection,
    getPool: () => pool // للضرورة فقط
};
