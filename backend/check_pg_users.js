const db = require('./db');

async function checkUsers() {
    try {
        console.log('🔍 فحص المستخدمين في PostgreSQL...\n');

        const result = await db.query('SELECT id, username, password FROM users');

        if (result.rows.length === 0) {
            console.log('❌ لا يوجد مستخدمين في قاعدة البيانات!');
            console.log('📝 سأقوم بإضافة المستخدم الافتراضي...\n');

            await db.query(
                'INSERT INTO users (username, password) VALUES ($1, $2)',
                ['essa6502', '0531055420']
            );

            console.log('✅ تم إضافة المستخدم الافتراضي بنجاح!');
            console.log('   Username: essa6502');
            console.log('   Password: 0531055420\n');
        } else {
            console.log('✅ المستخدمين الموجودين:\n');
            result.rows.forEach(user => {
                console.log(`   ID: ${user.id}`);
                console.log(`   Username: ${user.username}`);
                console.log(`   Password: ${user.password}`);
                console.log('   ---');
            });
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ خطأ:', err.message);
        process.exit(1);
    }
}

checkUsers();
