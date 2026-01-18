const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 1️⃣ استخدام متغير البيئة كما هو (بدون تعديل) - الالتزام التام بالـ Transaction Pooler (6543)
const connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    // إخفاء الباسوورد من اللوج للأمان
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Connection String: ${safeConnString}`);

    if (connectionString.includes('6543')) {
        console.log("🟢 PostgreSQL connected via Supabase Transaction Pooler (6543)");
    } else {
        console.log("⚠️ Connection string does not appear to be port 6543. Using whatever provided.");
    }
} else {
    console.error("❌ No DATABASE_URL found!");
}

// 2️⃣ إعدادات Pool مضبوطة بدقة + TCP Optimization
// بناءً على تحليل اللوج والمشاكل المستمرة في التايم أوت العشوائي
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 10, // Increased to handling dashboard/parallel requests
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 20000, // 20s
        keepAlive: false, // Reverted: Pgbouncer handles keepalive, client should be stateless
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

/* -------------------------------------------------------------------------- */
/*                               Helper Functions                             */
/* -------------------------------------------------------------------------- */

async function query(text, params) {
    // Smart Retry Logic with Exponential Backoff
    // لحل مشكلة "Retry Storm" وإعطاء الشبكة فرصة للتعافي
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Query failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);

            // لو الخطأ ليس له علاقة بالاتصال (مثلاً SQL Syntax)، ارمي الخطأ فوراً
            if (!err.message.includes('timeout') && !err.message.includes('connection') && !err.message.includes('57P01')) {
                throw err;
            }

            // Exponential Backoff: انتظر (1s, 2s, 4s)
            if (i < maxRetries - 1) {
                const delay = 1000 * Math.pow(2, i);
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
