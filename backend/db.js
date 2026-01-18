const { Pool } = require('pg');
const path = require('path');
// Load .env if exists (for local development), ignore if not found (for production/Render)
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// Support both DATABASE_URL (Render/Supabase) and individual env vars
// Support both DATABASE_URL (Render/Supabase) and individual env vars
let connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    console.log('   Type: Connection String (Found)');
    const host = connectionString.split('@')[1]?.split(':')[0] || 'Unknown';
    console.log('   Host:', host);

    // محاولة تحويل من pooler إلى direct connection إذا كان pooler يفشل
    // Supabase pooler يستخدم port 6543 (Transaction Mode) أو 5432 (Session Mode)
    // نعتبر 6543 هو اللي محتاج Fallback، لكن 5432 مستقر عادة
    if (connectionString.includes(':6543')) {
        console.log('   ⚠️  Detected Transaction Pooler (6543) - will try Session Mode (5432) on timeout');
    }
} else {
    console.log('   Type: Individual Vars (Fallback)');
    console.log('   Host:', process.env.DB_HOST || 'localhost (WARNING: Likely wrong for Render)');
}

// Function to create pool config
function createPoolConfig(connString) {
    const baseConfig = connString
        ? {
            connectionString: connString,
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

    // إعدادات محسّنة للخطط المجانية (Render + Supabase) - "وضع الطابور الواحد"
    baseConfig.max = 1; // 🛑 اتصال واحد فقط لا غير!
    baseConfig.min = 0;
    baseConfig.idleTimeoutMillis = 5000; // إغلاق الاتصال بسرعة لإتاحته لغيره
    baseConfig.connectionTimeoutMillis = 15000; // 15 ثانية كافية (لو زادت يبقى في مشكلة شبكة)
    baseConfig.allowExitOnIdle = true;

    // إزالة keep-alive المعقد لتقليل العبء
    // baseConfig.keepAlive = true; 

    return baseConfig;

    // إعدادات إضافية للاتصال
    baseConfig.statement_timeout = 30000; // 30 ثانية للـ query

    return baseConfig;
}

// Function to convert pooler URL to direct connection
function convertToDirectConnection(url) {
    if (!url) return url;

    // ببساطة: استبدال port 6543 بـ 5432 على نفس الـ host
    // Supabase pooler يستخدم port 6543 والـ direct connection يستخدم نفس الـ host لكن port 5432
    if (url.includes(':6543')) {
        const directUrl = url.replace(':6543', ':5432');
        console.log('   Converting pooler port 6543 to direct connection port 5432...');
        return directUrl;
    }

    // إذا كان pooler بدون port محدد، أضف port 5432
    if (url.includes('pooler') && !url.match(/:\d+/)) {
        // استبدال pooler.domain: أو pooler.domain/ بـ pooler.domain:5432/
        const directUrl = url.replace(/(pooler[^\/:]*)(\/|$)/, '$1:5432$2');
        console.log('   Adding direct connection port 5432 to pooler URL...');
        return directUrl;
    }

    return url;
}

const poolConfig = createPoolConfig(connectionString);

// إنشاء pool واحد فقط (singleton)
let pool = null;
let useDirectConnection = false; // Flag للتبديل إلى direct connection

function getPool() {
    if (!pool) {
        pool = new Pool(poolConfig);

        // معالجة الأخطاء
        pool.on('error', (err) => {
            console.error('خطأ غير متوقع في pool:', err);
            // إذا فشل الاتصال وكان pooler، جرب direct connection
            if (!useDirectConnection && connectionString && connectionString.includes('pooler')) {
                console.log('⚠️  Pooler failed, attempting to switch to direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    // إنشاء pool جديد بـ direct connection
                    if (pool) {
                        pool.end().catch(() => { });
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection');
                }
            }
        });

        pool.on('connect', () => {
            console.log('✓ اتصال جديد تم إنشاؤه في pool');
        });

        pool.on('remove', () => {
            console.log('⚠ تم إزالة اتصال من pool');
        });

        // Test connection on startup (non-blocking, silent failure)
        pool.query('SELECT NOW()')
            .then((result) => {
                console.log('✓ Database pool initialized successfully');
            })
            .catch(err => {
                // لا نطبع خطأ هنا لأن الاتصال سيُعاد المحاولة عند أول query
                // console.error('⚠️  Initial pool connection test failed (will retry on first query):', err.message);
            });
    }
    return pool;
}

// دالة للاستعلام مع إعادة المحاولة
async function query(text, params) {
    const maxRetries = 5; // زيادة عدد المحاولات
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await getPool().query(text, params);
            return result;
        } catch (err) {
            lastError = err;
            console.error(`محاولة ${i + 1}/${maxRetries} فشلت:`, err.message);

            // إذا كان timeout وكان transaction pooler (6543)، جرب session mode (5432)
            if (err.message.includes('timeout') && !useDirectConnection && connectionString && connectionString.includes(':6543') && i >= 2) {
                console.log('⚠️  Timeout detected after multiple attempts, trying direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    console.log('   Converting pooler URL to direct connection...');
                    if (pool) {
                        pool.end().catch(() => { });
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection, retrying query...');
                    continue; // أعد المحاولة مع الاتصال الجديد
                } else {
                    console.log('   ⚠️  Could not convert URL format');
                }
            }

            // إذا كان الخطأ متعلق بالاتصال، انتظر قليلاً قبل إعادة المحاولة (exponential backoff)
            if (i < maxRetries - 1) {
                const delay = Math.min(2000 * Math.pow(2, i), 15000); // Max 15 seconds
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// دالة للحصول على client من pool (للمعاملات) مع إعادة المحاولة
async function getClient() {
    const maxRetries = 5; // زيادة عدد المحاولات
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const client = await getPool().connect();
            return client;
        } catch (err) {
            lastError = err;
            console.error(`محاولة ${i + 1}/${maxRetries} للحصول على client فشلت:`, err.message);

            // إذا كان timeout وكان transaction pooler (6543)، جرب session mode (5432)
            if (err.message.includes('timeout') && !useDirectConnection && connectionString && connectionString.includes(':6543') && i >= 2) {
                console.log('⚠️  Timeout detected after multiple attempts, trying direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    console.log('   Converting pooler URL to direct connection...');
                    if (pool) {
                        pool.end().catch(() => { });
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection, retrying getClient...');
                    continue; // أعد المحاولة مع الاتصال الجديد
                } else {
                    console.log('   ⚠️  Could not convert URL format');
                }
            }

            // إذا كان الخطأ متعلق بالاتصال، انتظر قليلاً قبل إعادة المحاولة (exponential backoff)
            if (i < maxRetries - 1) {
                const delay = Math.min(2000 * Math.pow(2, i), 15000); // Max 15 seconds
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
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

// دالة للتحقق من الاتصال بالداتابيس
async function testConnection() {
    try {
        // استخدام getPool مباشرة لتجنب retry logic في query
        const testPool = getPool();
        const result = await testPool.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Connection test successful');
        console.log('   Current time:', result.rows[0].current_time);
        console.log('   Connection type:', useDirectConnection ? 'Direct' : (connectionString?.includes('pooler') ? 'Pooler' : 'Unknown'));
        return true;
    } catch (err) {
        console.error('❌ Connection test failed:', err.message);
        console.error('   Error code:', err.code || 'N/A');
        if (err.code) {
            console.error('   PostgreSQL error code:', err.code);
        }
        return false;
    }
}

// دالة للتحقق من الاتصال مع إعادة المحاولة (deprecated - لا تُستخدم بعد الآن)
async function ensureConnection(maxAttempts = 10) {
    // هذه الدالة غير مستخدمة الآن - الكود يحاول الاتصال عند أول query
    return true;
}

module.exports = {
    query,
    getClient,
    getPool,
    testConnection,
    ensureConnection
};
