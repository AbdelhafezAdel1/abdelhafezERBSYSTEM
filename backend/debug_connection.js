const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
console.log('Testing Connection URL:', connectionString.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(client => {
        console.log('✅ Connected successfully!');
        client.release();
        pool.end();
    })
    .catch(err => {
        console.error('❌ Connection Failed:', err.message);
        if (err.message.includes('password authorization failed')) {
            console.error('👉 CAUSE: Incorrect Password');
        }
        pool.end();
    });
