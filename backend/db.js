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
    // Supabase pooler يستخدم port 6543 أو pooler. في نهاية الـ host
    if (host.includes('pooler') || connectionString.includes(':6543')) {
        console.log('   ⚠️  Detected pooler connection - will try direct connection on timeout');
        // نحفظ connection string الأصلي للاستخدام المباشر
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

    // إعدادات محسّنة للخطط المجانية (Render + Supabase)
    baseConfig.max = 2; // تقليل عدد الاتصالات لتقليل الضغط على pooler
    baseConfig.min = 0; // السماح بإغلاق الاتصالات عند عدم الحاجة
    baseConfig.idleTimeoutMillis = 30000; // 30 ثانية
    baseConfig.connectionTimeoutMillis = 60000; // 60 ثانية (زيادة كبيرة لحل timeout)
    baseConfig.keepAlive = true;
    baseConfig.keepAliveInitialDelayMillis = 10000; // 10 ثواني
    baseConfig.allowExitOnIdle = true; // السماح بالإغلاق لتقليل الضغط
    
    return baseConfig;
}

// Function to convert pooler URL to direct connection
function convertToDirectConnection(url) {
    if (!url) return url;
    
    // استبدال pooler بـ direct connection
    // من: aws-1-ap-south-1.pooler.supabase.com:6543
    // إلى: aws-1-ap-south-1.supabase.co:5432
    let directUrl = url
        .replace(/\.pooler\.supabase\.com/g, '.supabase.co')
        .replace(/:6543/g, ':5432');
    
    // إذا كان نفس الـ URL، يعني لم يتم التحويل
    if (directUrl === url && url.includes('pooler')) {
        // محاولة أخرى - استبدال pooler فقط
        directUrl = url.replace(/pooler\./g, '');
        if (directUrl.includes(':6543')) {
            directUrl = directUrl.replace(':6543', ':5432');
        }
    }
    
    return directUrl;
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
                        pool.end().catch(() => {});
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

        // Test connection on startup (non-blocking)
        pool.query('SELECT NOW()')
            .then((result) => {
                console.log('✓ Database connected successfully');
                console.log('   Server time:', result.rows[0].now);
                console.log('   Connection type:', useDirectConnection ? 'Direct' : (connectionString?.includes('pooler') ? 'Pooler' : 'Unknown'));
            })
            .catch(err => {
                console.error('✗ Database connection error:', err.message);
                console.error('   Error code:', err.code || 'N/A');
                
                // إذا كان pooler يفشل، حاول direct connection
                if (!useDirectConnection && connectionString && connectionString.includes('pooler')) {
                    console.log('⚠️  Trying direct connection as fallback...');
                    useDirectConnection = true;
                    const directUrl = convertToDirectConnection(connectionString);
                    if (directUrl && directUrl !== connectionString) {
                        console.log('   Converting URL from pooler to direct connection...');
                        if (pool) {
                            pool.end().catch(() => {});
                        }
                        const directConfig = createPoolConfig(directUrl);
                        pool = new Pool(directConfig);
                        pool.query('SELECT NOW()')
                            .then((result) => {
                                console.log('✓ Direct connection successful');
                                console.log('   Server time:', result.rows[0].now);
                            })
                            .catch(e => {
                                console.error('✗ Direct connection also failed:', e.message);
                                console.error('   Error code:', e.code || 'N/A');
                            });
                    } else {
                        console.error('   Could not convert pooler URL to direct connection');
                    }
                }
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

            // إذا كان timeout وكان pooler، جرب direct connection
            if (err.message.includes('timeout') && !useDirectConnection && connectionString && connectionString.includes('pooler')) {
                console.log('⚠️  Timeout detected, switching to direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    if (pool) {
                        pool.end().catch(() => {});
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection, retrying query...');
                    continue; // أعد المحاولة مع الاتصال الجديد
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
            
            // إذا كان timeout وكان pooler، جرب direct connection
            if (err.message.includes('timeout') && !useDirectConnection && connectionString && connectionString.includes('pooler')) {
                console.log('⚠️  Timeout detected, switching to direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    if (pool) {
                        pool.end().catch(() => {});
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection, retrying getClient...');
                    continue; // أعد المحاولة مع الاتصال الجديد
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

// دالة للتحقق من الاتصال مع إعادة المحاولة
async function ensureConnection(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        console.log(`🔄 Connection attempt ${i + 1}/${maxAttempts}...`);
        const connected = await testConnection();
        if (connected) {
            console.log('✅ Database connection established successfully!');
            return true;
        }
        
        if (i < maxAttempts - 1) {
            const delay = Math.min(3000 * (i + 1), 30000); // Max 30 seconds
            console.log(`⏳ Waiting ${delay / 1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // محاولة تبديل إلى direct connection إذا كان pooler يفشل
            if (!useDirectConnection && connectionString && connectionString.includes('pooler')) {
                console.log('🔄 Attempting to switch to direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    if (pool) {
                        pool.end().catch(() => {});
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('✅ Switched to direct connection URL');
                }
            }
        }
    }
    
    console.error('❌ Failed to establish database connection after', maxAttempts, 'attempts');
    return false;
}

module.exports = {
    query,
    getClient,
    getPool,
    testConnection,
    ensureConnection
};
