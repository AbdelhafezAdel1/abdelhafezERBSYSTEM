const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🧪 Testing Database Connection...\n');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
}

console.log('🔌 Connection String:', connectionString.replace(/:[^:@]+@/, ':***@'));
console.log('');

const pool = new Pool({
    connectionString: connectionString,
    max: 1,
    connectionTimeoutMillis: 60000, // 60s timeout
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    console.log('⏳ Attempting to connect...');
    const startTime = Date.now();

    try {
        // Test basic query
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        const duration = Date.now() - startTime;

        console.log('✅ Connection successful!');
        console.log(`⏱️  Connection time: ${duration}ms`);
        console.log('📅 Server time:', result.rows[0].current_time);
        console.log('🗄️  PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
        console.log('');

        // Test table access
        console.log('🔍 Testing table access...');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        console.log(`✅ Found ${tables.rows.length} tables:`);
        tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
        console.log('');

        // Test users table
        const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
        console.log(`👥 Users in database: ${userCount.rows[0].count}`);

        const companyCount = await pool.query('SELECT COUNT(*) as count FROM companies');
        console.log(`🏢 Companies in database: ${companyCount.rows[0].count}`);

        const invoiceCount = await pool.query('SELECT COUNT(*) as count FROM invoices');
        console.log(`📄 Invoices in database: ${invoiceCount.rows[0].count}`);

        console.log('');
        console.log('🎉 All tests passed! Database is ready.');

    } catch (err) {
        const duration = Date.now() - startTime;
        console.error('❌ Connection failed after', duration, 'ms');
        console.error('Error:', err.message);
        console.error('');
        console.error('Possible causes:');
        console.error('  1. Database is sleeping (Supabase Free Tier)');
        console.error('  2. Wrong DATABASE_URL');
        console.error('  3. Network/firewall issue');
        console.error('  4. Database is paused in Supabase dashboard');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testConnection();
