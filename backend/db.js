const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 1️⃣ استخدام متغير البيئة كما هو - Port 5432 (Session Mode)
const connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    // إخفاء الباسوورد من اللوج للأمان
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Connection String: ${safeConnString}`);

    if (connectionString.includes('6543')) {
        console.log("⚠️ Transaction Pooler (6543) detected.");
    } else {
        console.log("🔵 Using Direct Connection / Session Mode (5432).");
    }
} else {
    console.error("❌ No DATABASE_URL found!");
}

// 2️⃣ إعدادات Pool مضبوطة بدقة + TCP Optimization
// بناءً على تحليل اللوج والمشاكل المستمرة في التايم أوت العشوائي
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 5, // Strict limit for free tier
        idleTimeoutMillis: 60000, // Increased to 60s
        connectionTimeoutMillis: 60000, // Increased to 60s to handle cold starts
        allowExitOnIdle: false, // Don't close idle connections in Session Mode
        keepAlive: true, // Crucial for 5432 stability
        keepAliveInitialDelayMillis: 10000,
        ssl: { rejectUnauthorized: false }
    }
    : {
        // Fallback for local development
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erb_system',
        password: process.env.DB_PASSWORD || 'password',
        port: 6543,
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
