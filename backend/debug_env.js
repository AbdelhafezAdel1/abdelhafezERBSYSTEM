// debug_env.js - عرض المتغيرات البيئية
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('=== Environment Variables ===\n');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ موجود' : '✗ غير موجود');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[HIDDEN]' : '✗ غير موجود');
console.log('DB_PORT:', process.env.DB_PORT);
console.log('\n=== Full DATABASE_URL (first 50 chars) ===');
if (process.env.DATABASE_URL) {
    console.log(process.env.DATABASE_URL.substring(0, 50) + '...');
}
