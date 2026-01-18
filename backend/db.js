const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 🔌 Transaction Pooler Configuration (Port 6543)
// Optimized for Render Free Tier with LONG timeouts for initial connection
let connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Target Connection: ${safeConnString}`);

    if (connectionString.includes('6543')) {
        console.log("✅ Using Transaction Pooler (Port 6543) - Extended Timeouts for Cold Start.");
    } else if (connectionString.includes('5432')) {
        console.log("✅ Using Session Mode (Port 5432) - Long-lived connections.");
    }
} else {
    console.error("❌ No DATABASE_URL found!");
}

// 🛡️ Optimized Pool Config for Transaction Pooler (Port 6543)
// KEY FIX: VERY LONG timeouts to handle Render + Supabase free tier cold starts
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 2, // MINIMAL: Only 2 connections to avoid overwhelming pooler during startup
        min: 0, // Don't force initial connections
        idleTimeoutMillis: 30000, // 30s idle timeout
        connectionTimeoutMillis: 60000, // 🔥 CRITICAL: 60 seconds to establish connection (was 20s)
        query_timeout: 30000, // 30s per query
        statement_timeout: 30000, // 30s per statement
        allowExitOnIdle: false, // Don't close pool when idle
        keepAlive: true, // Send TCP keep-alive packets
        keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10 seconds
        ssl: { rejectUnauthorized: false } // Required for Supabase
    }
    : {
        // Fallback for local development
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erb_system',
        password: process.env.DB_PASSWORD || 'password',
        port: 5432,
        max: 2,
        min: 0,
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
    // Smart Retry Logic with Exponential Backoff
    // INCREASED delays to handle Render + Supabase free tier cold starts
    const maxRetries = 5;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Query failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);

            // لو الخطأ ليس له علاقة بالاتصال (مثلاً SQL Syntax)، ارمي الخطأ فوراً
            if (!err.message.includes('timeout') &&
                !err.message.includes('connection') &&
                !err.message.includes('57P01') &&
                !err.message.includes('ETIMEDOUT') &&
                !err.message.includes('ECONNRESET')) {
                throw err;
            }

            // 🔥 INCREASED Exponential Backoff: (4s, 8s, 16s, 32s, 64s) instead of (2s, 4s, 8s, 16s, 32s)
            if (i < maxRetries - 1) {
                const delay = 4000 * Math.pow(2, i); // Changed from 2000 to 4000
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    // لو استنفذنا المحاولات
    console.error("❌ All query attempts failed.");
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
