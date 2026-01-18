const { Pool } = require('pg');
const path = require('path');
// Load .env if exists (for local development), ignore if not found (for production/Render)
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// Support both DATABASE_URL (Render/Supabase) and individual env vars
// Support both DATABASE_URL (Render/Supabase) and individual env vars
const connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    console.log('   Type: Connection String (Found)');
    console.log('   Host:', connectionString.split('@')[1]?.split(':')[0] || 'Unknown');
} else {
    console.log('   Type: Individual Vars (Fallback)');
    console.log('   Host:', process.env.DB_HOST || 'localhost (WARNING: Likely wrong for Render)');
}

const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false // Required for Supabase/Render
        }
    }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erb_system',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
        ssl: {
            rejectUnauthorized: false
        }
    };

// إعدادات محسّنة لحل مشكلة sleep والاتصال مع Supabase
// إعدادات صارمة للخطط المجانية (Render + Supabase)
poolConfig.max = 5; // 🔥 التعديل المقترح: 5 اتصالات (أفضل من 1 للتعامل مع الطلبات المتزامنة)
poolConfig.min = 1; // إبقاء هذا الاتصال مفتوحاً دائماً
poolConfig.idleTimeoutMillis = 30000; // 30 ثانية
poolConfig.connectionTimeoutMillis = 2000; // 2 ثانية (Fail Fast)
poolConfig.keepAlive = true;
poolConfig.keepAliveInitialDelayMillis = 0;
poolConfig.allowExitOnIdle = false; // عدم السماح بالخروج التلقائي للحفاظ على الاتصال نشطاً

// إنشاء pool واحد فقط (singleton)
let pool = null;

function getPool() {
    if (!pool) {
        pool = new Pool(poolConfig);

        // معالجة الأخطاء
        pool.on('error', (err) => {
            console.error('خطأ غير متوقع في pool:', err);
        });

        pool.on('connect', () => {
            console.log('✓ اتصال جديد تم إنشاؤه في pool');
        });

        pool.on('remove', () => {
            console.log('⚠ تم إزالة اتصال من pool');
        });

        // Test connection on startup
        pool.query('SELECT NOW()')
            .then(() => console.log('✓ Database connected successfully'))
            .catch(err => console.error('✗ Database connection error:', err.message));
    }
    return pool;
}

// دالة للاستعلام مع إعادة المحاولة
async function query(text, params) {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await getPool().query(text, params);
            return result;
        } catch (err) {
            lastError = err;
            console.error(`محاولة ${i + 1}/${maxRetries} فشلت:`, err.message);

            // إذا كان الخطأ متعلق بالاتصال، انتظر قليلاً قبل إعادة المحاولة
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    throw lastError;
}

// دالة للحصول على client من pool (للمعاملات)
async function getClient() {
    return await getPool().connect();
}

// تنظيف عند إغلاق التطبيق
process.on('SIGINT', async () => {
    if (pool) {
        await pool.end();
        console.log('✓ Pool connections closed');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (pool) {
        await pool.end();
        console.log('✓ Pool connections closed');
    }
    process.exit(0);
});

module.exports = {
    query,
    getClient,
    getPool
};
