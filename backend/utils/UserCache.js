const db = require('../db');

class UserCache {
    constructor() {
        this.users = new Map();
        this.isLoaded = false;

        // 🔥 Emergency Fallback: Add Admin user manually
        // وهذا يضمن دخول المدير حتى لو الداتابيز مفصولة!
        this.users.set('admin', {
            id: 1,
            username: 'admin',
            password: '100200300aa'
        });
        console.log('🛡️ Emergency Admin user loaded into memory.');
    }

    async init() {
        try {
            console.log('🔄 Loading additional users from DB...');
            // محاولة الاتصال مع timeout قصير للكاش
            const result = await db.query('SELECT * FROM users');

            // إضافة المستخدمين من قاعدة البيانات (بدون مسح الآدمن اليدوي)
            result.rows.forEach(user => {
                this.users.set(user.username, user);
            });

            this.isLoaded = true;
            console.log(`✅ UserCache loaded: ${this.users.size} users total.`);
        } catch (err) {
            console.error('❌ Failed to sync users from DB (Using fallback):', err.message);
            // نعتبر الكاش جاهزاً لأننا نملك الآدمن اليدوي
            this.isLoaded = true;
        }
    }

    getUser(username) {
        // If exact match found, return it
        if (this.users.has(username)) {
            return this.users.get(username);
        }
        return null;
    }

    async refresh() {
        await this.init();
    }
}

// Singleton instance
const userCache = new UserCache();
module.exports = userCache;
