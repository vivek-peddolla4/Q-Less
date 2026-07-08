require('dotenv').config();
const mongoose = require('mongoose');
const { createClient } = require('redis');

const results = [];

async function runChecks() {
  // Test 1: MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    results.push('  [OK]  MongoDB Atlas - Connected');
    await mongoose.connection.close();
  } catch (err) {
    results.push('  [FAIL] MongoDB - ' + err.message);
  }

  // Test 2: Redis
  const r = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000 } });
  r.on('error', function() {});
  try {
    await r.connect();
    await r.ping();
    results.push('  [OK]  Redis - Connected and responding');
    await r.disconnect();
  } catch (e) {
    results.push('  [FAIL] Redis - ' + e.message);
  }

  // Test 3: Required ENV vars
  const required = ['MONGO_URI', 'JWT_SECRET', 'REDIS_URL'];
  const missing = required.filter(function(k) {
    const v = process.env[k] || '';
    return !v || v.includes('REPLACE') || v.includes('<');
  });
  if (missing.length === 0) {
    results.push('  [OK]  ENV vars - All required vars set');
  } else {
    results.push('  [FAIL] ENV vars - Missing or placeholder: ' + missing.join(', '));
  }

  // Test 4: JWT_SECRET strength
  const jwtLen = (process.env.JWT_SECRET || '').length;
  if (jwtLen >= 64) {
    results.push('  [OK]  JWT_SECRET - Strong (' + jwtLen + ' chars)');
  } else {
    results.push('  [FAIL] JWT_SECRET - Too short (' + jwtLen + ' chars, need >= 64)');
  }

  // Test 5: uploads directory
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadDir)) {
    results.push('  [OK]  Uploads directory - Exists at ' + uploadDir);
  } else {
    results.push('  [FAIL] Uploads directory - Missing at ' + uploadDir);
  }

  // Test 6: Key deployment files
  const deployFiles = [
    '../docker-compose.yml',
    'Dockerfile',
    '.dockerignore',
    '../frontend/Dockerfile',
    '../frontend/nginx.conf',
    '../ai_service/Dockerfile'
  ];
  const missingFiles = deployFiles.filter(function(f) {
    return !fs.existsSync(path.join(__dirname, f));
  });
  if (missingFiles.length === 0) {
    results.push('  [OK]  Docker files - All Dockerfiles present');
  } else {
    results.push('  [FAIL] Docker files - Missing: ' + missingFiles.join(', '));
  }

  // Print results
  console.log('\n======================================');
  console.log('   DEPLOYMENT READINESS CHECK');
  console.log('======================================');
  results.forEach(function(r) { console.log(r); });
  const failures = results.filter(function(r) { return r.includes('[FAIL]'); });
  console.log('--------------------------------------');
  if (failures.length === 0) {
    console.log('  RESULT: READY FOR DEPLOYMENT');
  } else {
    console.log('  RESULT: ' + failures.length + ' ISSUE(S) FOUND');
  }
  console.log('======================================\n');
  process.exit(0);
}

runChecks().catch(function(err) {
  console.error('Check failed:', err.message);
  process.exit(1);
});
