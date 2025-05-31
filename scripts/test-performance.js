#!/usr/bin/env node

import fetch from 'node-fetch';

async function testPerformance() {
  console.log('🚀 Testing Claude Code Performance Improvements');
  console.log('='.repeat(50));
  
  try {
    // First, scan for changes
    console.log('\n📊 Scanning for changes...');
    const scanResponse = await fetch('http://localhost:3003/api/git/scan-all');
    const packages = await scanResponse.json();
    
    if (packages.length === 0) {
      console.log('No changes found. Make some changes and try again.');
      return;
    }
    
    console.log(`Found changes in ${packages.length} packages:`);
    packages.forEach(pkg => {
      console.log(`  - ${pkg.package}: ${pkg.changes.length} files`);
    });
    
    // Test 1: Cold cache (first run)
    console.log('\n🧪 Test 1: Cold Cache Performance');
    const startCold = Date.now();
    
    const coldResponse = await fetch('http://localhost:3003/api/claude/generate-commit-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: packages,
        timestamp: new Date().toISOString(),
      }),
    });
    
    const coldData = await coldResponse.json();
    const coldTime = Date.now() - startCold;
    
    console.log(`  ⏱️  Response time: ${coldTime}ms`);
    console.log(`  📊 Cache hit: ${coldData.performance?.cacheHit ? 'Yes' : 'No'}`);
    console.log(`  ✅ Generated ${coldData.messages?.length || 0} messages`);
    
    // Test 2: Warm cache (second run with same data)
    console.log('\n🧪 Test 2: Warm Cache Performance');
    const startWarm = Date.now();
    
    const warmResponse = await fetch('http://localhost:3003/api/claude/generate-commit-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: packages,
        timestamp: new Date().toISOString(),
      }),
    });
    
    const warmData = await warmResponse.json();
    const warmTime = Date.now() - startWarm;
    
    console.log(`  ⏱️  Response time: ${warmTime}ms`);
    console.log(`  📊 Cache hit: ${warmData.performance?.cacheHit ? 'Yes' : 'No'}`);
    console.log(`  🚀 Speed improvement: ${Math.round((1 - warmTime/coldTime) * 100)}%`);
    
    // Test 3: Get performance metrics
    console.log('\n📈 Overall Performance Metrics');
    const metricsResponse = await fetch('http://localhost:3003/api/claude/metrics');
    const metrics = await metricsResponse.json();
    
    console.log(`  📊 Cache hits: ${metrics.metrics.cacheHits}`);
    console.log(`  ❌ Cache misses: ${metrics.metrics.cacheMisses}`);
    console.log(`  🤖 Claude calls: ${metrics.metrics.claudeCalls}`);
    console.log(`  ⏱️  Average response time: ${metrics.metrics.averageResponseTime}ms`);
    console.log(`  💾 Cache size: ${metrics.cacheSize} entries`);
    
    // Test 4: Batch processing simulation
    console.log('\n🧪 Test 3: Batch Processing (if multiple packages)');
    if (packages.length > 1) {
      const batchPromises = packages.map(pkg => 
        fetch('http://localhost:3003/api/claude/generate-commit-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changes: [pkg],
            timestamp: new Date().toISOString(),
            allowBatching: true, // Enable batching
          }),
        })
      );
      
      const startBatch = Date.now();
      await Promise.all(batchPromises);
      const batchTime = Date.now() - startBatch;
      
      console.log(`  ⏱️  Batch processing time: ${batchTime}ms`);
      console.log(`  📦 Average per package: ${Math.round(batchTime / packages.length)}ms`);
    }
    
    console.log('\n✅ Performance tests complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testPerformance();