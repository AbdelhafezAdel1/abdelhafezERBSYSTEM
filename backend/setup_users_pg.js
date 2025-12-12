// setup_users_pg.js - Setup users in PostgreSQL (Supabase)
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const USERNAME = 'essa6502';
const PASSWORD = '0531055420';

async function setupUsers() {
    try {
        console.log('Connecting to PostgreSQL...');

        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('Creating users table...');
            await pool.query(`
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL
                );
            `);
            console.log('✓ Users table created');
        } else {
            console.log('✓ Users table exists');
        }

        // Clear existing users
        await pool.query('DELETE FROM users');
        console.log('✓ Cleared existing users');

        // Insert the user
        await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [USERNAME, PASSWORD]
        );
        console.log(`✓ User "${USERNAME}" created successfully`);

        // Verify
        const result = await pool.query('SELECT id, username FROM users');
        console.log('\nUsers in database:', result.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
        console.log('\nDatabase connection closed.');
    }
}

setupUsers();
