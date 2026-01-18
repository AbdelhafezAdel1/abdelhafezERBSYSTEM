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

// 2️⃣ إعدادات Pool قوية (High Availability Config)
// بناءً على التوصيات: رفعنا العدد والوقت لتفادي الـ Timeouts أثناء الـ Warm-up
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 20, // زيادة العدد لأن Transaction Mode بيتحمل
        idleTimeoutMillis: 30000, // 30 ثانية
        connectionTimeoutMillis: 40000, // 40 ثانية (أعطه وقته عشان يوصل)
        ssl: { rejectUnauthorized: false }
    }
    : {
        // Fallback for local development if .env is missing URL
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
    // Simple retry logic for connectivity hiccups only (NOT switching ports)
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
            // الخطأ 57P01 (admin_shutdown) أو connection errors تستحق المحاولة
            if (!err.message.includes('timeout') && !err.message.includes('connection') && !err.message.includes('57P01')) {
                throw err;
            }

            // انتظار قصير قبل المحاولة التالية
            if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 1000));
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
