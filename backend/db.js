const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 1️⃣ Automatic Optimization: Force Transaction Pooler (Port 6543) for Supabase
// This fixes the "Connection terminated" and "Timeout" issues on Render
let connectionString = process.env.DATABASE_URL;

if (connectionString && connectionString.includes('supabase.com') && connectionString.includes('5432')) {
    console.log("🔄 Auto-Switching to Transaction Pooler (Port 5432 -> 6543)...");
    connectionString = connectionString.replace('5432', '6543');
}

console.log('🔌 DB Config Check:');
if (connectionString) {
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Target Connection: ${safeConnString}`);

    if (connectionString.includes('6543')) {
        console.log("✅ Using Transaction Pooler (Optimized for Render).");
    } else {
        console.warn("⚠️ Still using Session Mode (5432) - Timeouts may occur.");
    }
} else {
    console.error("❌ No DATABASE_URL found!");
}

// 2️⃣ Optimized Pool Config for Transaction Mode
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 10, // Transaction pooler can handle more connections
        idleTimeoutMillis: 20000, // Close idle connections faster to free up pooler slots
        connectionTimeoutMillis: 10000, // Fail fast if pooler is down
        allowExitOnIdle: false,
        ssl: { rejectUnauthorized: false } // Required for Supabase
    }
    : {
        // Fallback for local development
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erb_system',
        password: process.env.DB_PASSWORD || 'password',
        port: 5432,
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
    // لحل مشكلة "Retry Storm" وإعطاء الشبكة فرصة للتعافي
    const maxRetries = 5; // Increased to 5
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Query failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);

            // لو الخطأ ليس له علاقة بالاتصال (مثلاً SQL Syntax)، ارمي الخطأ فوراً
            // added 'ETIMEDOUT' and 'ECONNRESET' to retryable errors
            if (!err.message.includes('timeout') &&
                !err.message.includes('connection') &&
                !err.message.includes('57P01') &&
                !err.message.includes('ETIMEDOUT') &&
                !err.message.includes('ECONNRESET')) {
                throw err;
            }

            // Exponential Backoff: انتظر (2s, 4s, 8s, 16s, 32s)
            if (i < maxRetries - 1) {
                const delay = 2000 * Math.pow(2, i);
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
