const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 🔌 FINAL CONFIG: DIRECT CONNECTION (IPv4 Force)
// This config relies on the DNS fix in app_pg.js
const connectionString = process.env.DATABASE_URL;

console.log('🔌 DB Config Check:');
if (connectionString) {
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Target: ${safeConnString}`);

    if (connectionString.includes('pooler')) {
        console.warn("⚠️ Warning: You are using Pooler URL. Direct Connection (db...supabase.co) is recommended with IPv4 fix.");
    } else {
        console.log("✅ Using Direct Connection (Recommended)");
    }
}

// 🛡️ Robust Pool Config for Direct Connection
const poolConfig = connectionString
    ? {
        connectionString: connectionString,
        max: 3, // Low max for free tier
        min: 0, // Don't hold connections
        idleTimeoutMillis: 5000, // Close idle fast
        connectionTimeoutMillis: 10000, // Fast fail
        allowExitOnIdle: true,
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('❌ DB Pool Error:', err.message);
});

pool.on('connect', () => {
    console.log('🔌 DB Connected');
});

// Helper Functions
async function query(text, params) {
    try {
        return await pool.query(text, params);
    } catch (err) {
        // Retry logic for 1 time only to keep it simple
        if (err.message.includes('timeout') || err.message.includes('connection')) {
            console.log(`⚠️ Retry query due to ${err.message}`);
            await new Promise(r => setTimeout(r, 1000));
            return await pool.query(text, params);
        }
        throw err;
    }
}

async function getClient() {
    return await pool.connect();
}

async function testConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('✅ DB Connection Verified');
        return true;
    } catch (err) {
        console.error('❌ DB Connection Failed:', err.message);
        return false;
    }
}

module.exports = {
    query,
    getClient,
    testConnection,
    getPool: () => pool
};
