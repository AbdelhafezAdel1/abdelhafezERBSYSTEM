// Quick Database Connection Test
require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Testing Database Connection...\n');

// Show current config (masked password)
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
    const masked = dbUrl.replace(/:[^:@]+@/, ':***@');
    console.log('📋 DATABASE_URL:', masked);
} else {
    console.log('❌ No DATABASE_URL found in .env');
    process.exit(1);
}

// Extract hostname for DNS test
const hostnameMatch = dbUrl.match(/@([^:]+):/);
const hostname = hostnameMatch ? hostnameMatch[1] : null;

if (hostname) {
    console.log('🌐 Hostname:', hostname);
    console.log('\n🔄 Testing DNS resolution...');

    const dns = require('dns');
    dns.lookup(hostname, (err, address) => {
        if (err) {
            console.error('❌ DNS Lookup Failed:', err.message);
            console.log('\n💡 Possible issues:');
            console.log('   1. Supabase project is paused or deleted');
            console.log('   2. Hostname is incorrect');
            console.log('   3. Network/firewall blocking access');
            console.log('\n📝 Action: Check your Supabase dashboard at https://supabase.com/dashboard');
            process.exit(1);
        } else {
            console.log('✅ DNS resolved to:', address);
            testConnection();
        }
    });
} else {
    console.error('❌ Could not extract hostname from DATABASE_URL');
    process.exit(1);
}

async function testConnection() {
    console.log('\n🔄 Testing PostgreSQL connection...');

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
    });

    try {
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Connection successful!');
        console.log('⏰ Server time:', result.rows[0].current_time);
        console.log('📦 PostgreSQL:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);

        // Test users table
        console.log('\n🔄 Testing users table...');
        const users = await pool.query('SELECT COUNT(*) as count FROM users');
        console.log('✅ Users table accessible. Count:', users.rows[0].count);

        await pool.end();
        console.log('\n🎉 All tests passed! Database is ready.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        console.log('\n💡 Error details:', err.code || 'Unknown');

        if (err.message.includes('ENOTFOUND')) {
            console.log('\n📝 This is a DNS error. Your Supabase hostname cannot be found.');
            console.log('   → Go to Supabase Dashboard and get the correct connection string');
        } else if (err.message.includes('ECONNREFUSED')) {
            console.log('\n📝 Connection refused. Database might be down or firewall blocking.');
        } else if (err.message.includes('password')) {
            console.log('\n📝 Authentication failed. Check your password in .env');
        }

        await pool.end();
        process.exit(1);
    }
}
