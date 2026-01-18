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
    baseConfig.max = 5; // زيادة عدد الاتصالات للسرعة
    baseConfig.min = 1; // إبقاء اتصال واحد مفتوح دائماً
    baseConfig.idleTimeoutMillis = 30000; // 30 ثانية
    baseConfig.connectionTimeoutMillis = 10000; // 10 ثواني (fail fast - أفضل من الانتظار طويلاً)
    baseConfig.keepAlive = true;
    baseConfig.keepAliveInitialDelayMillis = 5000; // 5 ثواني
    baseConfig.allowExitOnIdle = false; // عدم السماح بالإغلاق للحفاظ على الاتصال
    
    return baseConfig;
}

// Function to convert pooler URL to direct connection
function convertToDirectConnection(url) {
    if (!url) return url;
    
    try {
        // استبدال pooler بـ direct connection
        // من: aws-1-ap-south-1.pooler.supabase.com:6543
        // إلى: aws-1-ap-south-1.supabase.co:5432
        
        // طريقة 1: استبدال .pooler.supabase.com بـ .supabase.co
        let directUrl = url.replace(/\.pooler\.supabase\.com/g, '.supabase.co');
        
        // طريقة 2: إذا لم يتغير، جرب استبدال pooler. فقط
        if (directUrl === url && url.includes('pooler')) {
            directUrl = url.replace(/pooler\./g, '');
            // إذا كان pooler. في البداية، قد نحتاج استبدال أفضل
            if (directUrl.includes('.supabase.com')) {
                directUrl = directUrl.replace(/\.supabase\.com/g, '.supabase.co');
            }
        }
        
        // استبدال port 6543 بـ 5432
        if (directUrl.includes(':6543')) {
            directUrl = directUrl.replace(/:6543/g, ':5432');
        }
        
        // التأكد من تغيير الـ URL
        if (directUrl !== url) {
            console.log('   Converted pooler URL to direct connection');
            console.log('   From:', url.substring(0, 50) + '...');
            console.log('   To:', directUrl.substring(0, 50) + '...');
        }
        
        return directUrl;
    } catch (err) {
        console.error('   Error converting URL:', err.message);
        return url; // إرجاع URL الأصلي عند الخطأ
    }
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

// دالة للاستعلام مع إعادة المحاولة الذكية
async function query(text, params) {
    const maxRetries = 3; // تقليل المحاولات للسرعة
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await getPool().query(text, params);
            return result;
        } catch (err) {
            lastError = err;
            
            // إذا كان timeout وكان pooler، جرب direct connection فوراً
            if ((err.message.includes('timeout') || err.message.includes('Connection terminated')) && 
                !useDirectConnection && 
                connectionString && 
                connectionString.includes('pooler')) {
                console.log('⚠️  Pooler timeout detected, switching to direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    if (pool) {
                        pool.end().catch(() => {});
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection, retrying...');
                    // أعد المحاولة فوراً بدون تأخير
                    continue;
                }
            }

            // إذا كان الخطأ متعلق بالاتصال، انتظر قليلاً قبل إعادة المحاولة
            if (i < maxRetries - 1) {
                const delay = 1000 * (i + 1); // تأخير بسيط: 1s, 2s, 3s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// دالة للحصول على client من pool (للمعاملات) مع إعادة المحاولة
async function getClient() {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const client = await getPool().connect();
            return client;
        } catch (err) {
            lastError = err;
            
            // إذا كان timeout وكان pooler، جرب direct connection فوراً
            if ((err.message.includes('timeout') || err.message.includes('Connection terminated')) && 
                !useDirectConnection && 
                connectionString && 
                connectionString.includes('pooler')) {
                console.log('⚠️  Pooler timeout detected, switching to direct connection...');
                useDirectConnection = true;
                const directUrl = convertToDirectConnection(connectionString);
                if (directUrl && directUrl !== connectionString) {
                    if (pool) {
                        pool.end().catch(() => {});
                        pool = null;
                    }
                    const directConfig = createPoolConfig(directUrl);
                    pool = new Pool(directConfig);
                    console.log('🔄 Switched to direct connection, retrying...');
                    continue;
                }
            }
            
            // تأخير بسيط قبل إعادة المحاولة
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
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

// دالة للتحقق من الاتصال بالداتابيس (سريعة - بدون retry)
async function testConnection() {
    try {
        const testPool = getPool();
        // استخدام timeout قصير للسرعة
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection test timeout')), 5000)
        );
        const queryPromise = testPool.query('SELECT NOW()');
        const result = await Promise.race([queryPromise, timeoutPromise]);
        console.log('✅ Connection test successful');
        console.log('   Server time:', result.rows[0].now);
        console.log('   Connection type:', useDirectConnection ? 'Direct' : (connectionString?.includes('pooler') ? 'Pooler' : 'Unknown'));
        return true;
    } catch (err) {
        return false;
    }
}

module.exports = {
    query,
    getClient,
    getPool,
    testConnection
};
