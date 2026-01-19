#!/usr/bin/env node

const db = require('./db');

async function debugConnections() {
    console.log('🔍 Debugging database connections...\n');
    
    // Test primary connection
    console.log('1️⃣ Testing PRIMARY connection (Pooler):');
    try {
        const primaryResult = await db.getPool().query('SELECT 1 as test, NOW() as server_time');
        console.log('✅ PRIMARY connection successful');
        console.log(`   Server time: ${primaryResult.rows[0].server_time}`);
        console.log(`   Pool status: ${db.getPool().totalCount} connections\n`);
    } catch (err) {
        console.error('❌ PRIMARY connection failed:', err.message);
        console.error(`   Error code: ${err.code}\n`);
    }
    
    // Test fallback connection
    const fallbackPool = db.getFallbackPool();
    if (fallbackPool) {
        console.log('2️⃣ Testing FALLBACK connection (Direct):');
        try {
            const fallbackResult = await fallbackPool.query('SELECT 1 as test, NOW() as server_time');
            console.log('✅ FALLBACK connection successful');
            console.log(`   Server time: ${fallbackResult.rows[0].server_time}`);
            console.log(`   Pool status: ${fallbackPool.totalCount} connections\n`);
        } catch (err) {
            console.error('❌ FALLBACK connection failed:', err.message);
            console.error(`   Error code: ${err.code}\n`);
        }
    } else {
        console.log('ℹ️ No fallback connection configured\n');
    }
    
    // Test circuit breaker state
    console.log('3️⃣ Circuit Breaker Status:');
    const cbState = db.getCircuitBreakerState();
    console.log(`   Status: ${cbState.isOpen ? 'OPEN' : 'CLOSED'}`);
    console.log(`   Failures: ${cbState.failureCount}`);
    console.log(`   Consecutive successes: ${cbState.consecutiveSuccesses}`);
    
    if (cbState.lastFailureTime) {
        const timeSinceFailure = Date.now() - cbState.lastFailureTime;
        console.log(`   Last failure: ${Math.round(timeSinceFailure / 1000)}s ago`);
    }
    
    console.log('\n🎯 Recommendation:');
    if (cbState.isOpen) {
        console.log('   ⚠️ Circuit breaker is OPEN - wait for it to reset');
    } else {
        console.log('   ✅ Circuit breaker is CLOSED - connections should work');
    }
}

// Run tests
debugConnections().catch(console.error);
