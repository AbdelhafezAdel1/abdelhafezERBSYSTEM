const db = require('../db');

class UserCache {
    constructor() {
        this.users = new Map();
        this.isLoaded = false;
    }

    async init() {
        try {
            console.log('🔄 Loading users into memory cache...');
            const result = await db.query('SELECT * FROM users');
            this.users.clear();

            result.rows.forEach(user => {
                this.users.set(user.username, user);
            });

            this.isLoaded = true;
            console.log(`✅ UserCache loaded: ${this.users.size} users ready for instant login.`);
        } catch (err) {
            console.error('❌ Failed to load UserCache:', err.message);
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
