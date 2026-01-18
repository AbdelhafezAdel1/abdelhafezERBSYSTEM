const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), silent: true });

// 🔌 DATABASE CONNECTION CONFIG
// Priority: Use DATABASE_URL if available, otherwise build from individual vars
let connectionString = process.env.DATABASE_URL;

// If no DATABASE_URL, build it from parts
if (!connectionString && process.env.DB_HOST) {
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || 5432;
    const database = process.env.DB_NAME || 'postgres';

    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

console.log('🔌 DB Config Check:');
if (connectionString) {
    const safeConnString = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log(`   Target: ${safeConnString}`);

    // Check if using pooler (recommended for Render free tier)
    if (connectionString.includes('pooler') || connectionString.includes('6543')) {
        console.log("✅ Using Supabase Pooler (Transaction Mode - Recommended for Render)");
    } else if (connectionString.includes('5432')) {
        console.log("⚠️ Using Direct Connection (Port 5432). If issues occur, try Pooler on port 6543");
    }
} else {
    console.error("❌ No database configuration found! Set DATABASE_URL or DB_* vars");
}

// 🛡️ Pool Config optimized for free tier
const poolConfig = {
    connectionString: connectionString,
    max: 3,                         // Low max for free tier
    min: 0,                         // Don't hold connections
    idleTimeoutMillis: 10000,       // Close idle connections fast
    connectionTimeoutMillis: 15000, // Longer timeout for DNS resolution
    allowExitOnIdle: true,
    ssl: {
        rejectUnauthorized: false
    }
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('❌ DB Pool Error:', err.message);
});

pool.on('connect', () => {
    console.log('🔌 DB Connected successfully');
});

// Helper Functions
async function query(text, params) {
    const maxRetries = 2;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (err) {
            lastError = err;

            // Retry on timeout/connection errors
            if (attempt < maxRetries && (
                err.message.includes('timeout') ||
                err.message.includes('ECONNREFUSED') ||
                err.message.includes('ENOTFOUND')
            )) {
                console.log(`⚠️ Retry ${attempt}/${maxRetries} for query due to: ${err.message}`);
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }

            throw err;
        }
    }

    throw lastError;
}

async function getClient() {
    return await pool.connect();
}

async function testConnection() {
    try {
        await pool.query('SELECT 1 as test');
        console.log('✅ DB Connection Verified');
        return true;
    } catch (err) {
        console.error('❌ DB Connection Failed:', err.message);
        console.error('💡 Check: 1) Supabase project is active, 2) Credentials are correct, 3) Try pooler URL on port 6543');
        return false;
    }
}

module.exports = {
    query,
    getClient,
    testConnection,
    getPool: () => pool
};
