const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL (Render/Supabase) and individual env vars
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
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
    };

// إعدادات محسّنة لحل مشكلة sleep والاتصال
poolConfig.max = 20; // الحد الأقصى للاتصالات في الـ pool
poolConfig.min = 2; // الحد الأدنى للاتصالات النشطة دائماً
poolConfig.idleTimeoutMillis = 30000; // 30 ثانية قبل إغلاق اتصال خامل
poolConfig.connectionTimeoutMillis = 60000; // 60 ثانية timeout للاتصال
poolConfig.keepAlive = true; // إبقاء الاتصال نشط
poolConfig.keepAliveInitialDelayMillis = 10000; // بدء keep-alive بعد 10 ثواني
poolConfig.query_timeout = 30000; // 30 ثانية timeout للاستعلام
poolConfig.statement_timeout = 30000; // 30 ثانية timeout للعبارة

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
