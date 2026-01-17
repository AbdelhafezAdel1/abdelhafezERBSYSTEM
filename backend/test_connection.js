// test_connection.js - اختبار الاتصال بقاعدة البيانات
const db = require('./db');

async function testConnection() {
    console.log('🔍 اختبار الاتصال بقاعدة البيانات...\n');

    try {
        console.log('📡 محاولة الاتصال...');
        const start = Date.now();

        const result = await db.query('SELECT NOW() as current_time, version() as pg_version');

        const duration = Date.now() - start;

        console.log('✅ الاتصال ناجح!');
        console.log(`⏱️  الوقت المستغرق: ${duration}ms`);
        console.log(`🕐 وقت السرفر: ${result.rows[0].current_time}`);
        console.log(`📦 إصدار PostgreSQL: ${result.rows[0].pg_version}\n`);

        // اختبار جدول المستخدمين
        console.log('🔍 اختبار جدول المستخدمين...');
        const usersResult = await db.query('SELECT COUNT(*) as user_count FROM users');
        console.log(`👥 عدد المستخدمين: ${usersResult.rows[0].user_count}`);

        // عرض المستخدمين
        const allUsers = await db.query('SELECT id, username FROM users LIMIT 5');
        console.log('\n📋 المستخدمون:');
        allUsers.rows.forEach(user => {
            console.log(`   - ID: ${user.id}, Username: ${user.username}`);
        });

        console.log('\n✅ جميع الاختبارات نجحت!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ فشل الاتصال!');
        console.error('📝 تفاصيل الخطأ:', error.message);
        console.error('🔧 الكود:', error.code);
        console.error('\n💡 الحلول المقترحة:');
        console.error('   1. تحقق من ملف .env');
        console.error('   2. تأكد من أن قاعدة البيانات تعمل');
        console.error('   3. تحقق من الـ firewall والشبكة');
        console.error('   4. تأكد من صحة كلمة المرور');
        process.exit(1);
    }
}

testConnection();
