#!/usr/bin/env node

const db = require('./db');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    console.log('🚀 Starting database setup...');
    
    try {
        // Test connection first
        const connected = await db.testConnection();
        if (!connected) {
            console.error('❌ Cannot proceed with setup - database connection failed');
            process.exit(1);
        }

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'db_schema.sql');
        if (!fs.existsSync(schemaPath)) {
            console.error('❌ Schema file not found:', schemaPath);
            process.exit(1);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`📝 Executing ${statements.length} SQL statements...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                await db.query(statement);
                console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
            } catch (err) {
                // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS
                if (err.code === '42P07' || err.message.includes('already exists')) {
                    console.log(`ℹ️ Statement ${i + 1}/${statements.length} - Table already exists`);
                } else {
                    console.error(`❌ Statement ${i + 1}/${statements.length} failed:`, err.message);
                    console.error('Statement:', statement.substring(0, 100) + '...');
                    throw err;
                }
            }
        }

        // Verify tables were created
        const tablesCheck = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        const expectedTables = ['users', 'companies', 'invoices', 'invoice_items', 'bonds', 'settings'];
        const existingTables = tablesCheck.rows.map(row => row.table_name);
        
        console.log('📊 Database tables:', existingTables);
        
        const missingTables = expectedTables.filter(table => !existingTables.includes(table));
        if (missingTables.length > 0) {
            console.error('❌ Missing tables:', missingTables);
            process.exit(1);
        }

        // Check for default admin user
        const adminCheck = await db.query('SELECT * FROM users WHERE username = $1', ['admin']);
        if (adminCheck.rows.length === 0) {
            console.log('👤 Creating default admin user...');
            await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', 
                ['admin', '100200300aa']);
            console.log('✅ Default admin user created (admin/100200300aa)');
        } else {
            console.log('👤 Admin user already exists');
        }

        console.log('🎉 Database setup completed successfully!');
        console.log('💡 You can now start the application with: npm start');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    }
}

// Run setup if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };
