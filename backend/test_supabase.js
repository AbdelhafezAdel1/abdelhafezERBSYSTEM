#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

console.log('🔍 Testing Supabase connection...');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env');
    console.error('💡 Please set DATABASE_URL=postgresql://user:password@host:port/database');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        console.log('📡 Connecting to Supabase...');
        const result = await pool.query('SELECT version() as version, current_database() as database, current_user as user');
        
        console.log('✅ Connection successful!');
        console.log(`   Version: ${result.rows[0].version}`);
        console.log(`   Database: ${result.rows[0].database}`);
        console.log(`   User: ${result.rows[0].user}`);
        
        // Test if tables exist
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log(`📊 Found ${tables.rows.length} tables:`);
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        return true;
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        console.error('💡 Check:');
        console.error('   1. DATABASE_URL is correct');
        console.error('   2. Supabase project is active');
        console.error('   3. Network allows connection to Supabase');
        console.error('   4. User/password are correct');
        console.error('   5. Pooler port (6543) vs Direct (5432)');
        
        return false;
    } finally {
        await pool.end();
    }
}

testConnection().then(success => {
    if (success) {
        console.log('🎉 Supabase connection is ready for migration!');
        console.log('\n📋 Next steps:');
        console.log('1. Run: node backend/migrate_data.js');
        console.log('2. Check Supabase Dashboard to verify data');
    } else {
        console.log('❌ Please fix connection issues before running migration');
        process.exit(1);
    }
}).catch(err => {
    console.error('💥 Script failed:', err.message);
    process.exit(1);
});
