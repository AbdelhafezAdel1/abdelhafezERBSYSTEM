const db = require('./db');

async function optimizeDatabase() {
    try {
        console.log('🔧 تحسين قاعدة البيانات...\n');

        // إضافة index على username لتسريع عملية تسجيل الدخول
        console.log('📊 إضافة index على username...');
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_username 
            ON users(username)
        `);
        console.log('✅ تم إضافة index على username\n');

        // إضافة index على username + password معاً
        console.log('📊 إضافة index على username و password...');
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_login 
            ON users(username, password)
        `);
        console.log('✅ تم إضافة index على username و password\n');

        // التحقق من وجود المستخدم
        console.log('👤 التحقق من المستخدم الافتراضي...');
        const result = await db.query('SELECT username FROM users WHERE username = $1', ['admin']);

        if (result.rows.length === 0) {
            console.log('⚠️  المستخدم غير موجود، سيتم إضافته عند تشغيل السيرفر');
        } else {
            console.log('✅ المستخدم موجود:', result.rows[0].username);
        }

        console.log('\n✅ تم تحسين قاعدة البيانات بنجاح!');
        console.log('📝 الآن يمكنك تشغيل السيرفر بالأمر: npm start');

        process.exit(0);
    } catch (err) {
        console.error('❌ خطأ:', err.message);
        process.exit(1);
    }
}

optimizeDatabase();
