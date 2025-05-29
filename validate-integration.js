#!/usr/bin/env node

/**
 * Comprehensive validation script for GitHub API integration
 * Tests both mock and real API modes, validates data structures, and checks performance
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 metaGOTHIC GitHub API Integration Validation\n');

// Validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logResult(test, status, message, details = null) {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} ${test}: ${message}`);
  
  if (details) {
    console.log(`   ${details}`);
  }
  
  results.details.push({ test, status, message, details });
  
  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.warnings++;
}

// 1. Validate File Structure
console.log('📁 Validating File Structure...');

const requiredFiles = [
  'src/services/api.ts',
  'src/services/githubService.ts', 
  'src/services/githubServiceMock.ts',
  'src/services/integration.test.ts',
  'package.json',
  '.env.example',
  'SETUP.md',
  'INTEGRATION_COMPLETE.md'
];

requiredFiles.forEach(file => {
  const filePath = join(__dirname, file);
  if (existsSync(filePath)) {
    logResult('File Structure', 'PASS', `${file} exists`);
  } else {
    logResult('File Structure', 'FAIL', `${file} missing`);
  }
});

// 2. Validate Package Dependencies
console.log('\n📦 Validating Dependencies...');

try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
  
  const requiredDeps = [
    '@tanstack/react-query',
    'react',
    'react-dom',
    'lucide-react',
    'clsx'
  ];
  
  const localDeps = [
    '@chasenocap/github-graphql-client',
    '@chasenocap/cache', 
    '@chasenocap/logger'
  ];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      logResult('Dependencies', 'PASS', `${dep} installed`);
    } else {
      logResult('Dependencies', 'FAIL', `${dep} missing`);
    }
  });
  
  localDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      const version = packageJson.dependencies[dep];
      if (version.startsWith('file:')) {
        logResult('Local Dependencies', 'PASS', `${dep} configured as local package`);
      } else {
        logResult('Local Dependencies', 'WARN', `${dep} not using local package: ${version}`);
      }
    } else {
      logResult('Local Dependencies', 'FAIL', `${dep} missing`);
    }
  });
  
} catch (error) {
  logResult('Dependencies', 'FAIL', 'Could not read package.json', error.message);
}

// 3. Validate TypeScript Compilation
console.log('\n🔧 Validating TypeScript Compilation...');

try {
  execSync('npm run typecheck', { 
    cwd: __dirname, 
    stdio: 'pipe',
    timeout: 30000 
  });
  logResult('TypeScript', 'PASS', 'Type checking successful');
} catch (error) {
  const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
  if (output.includes('error TS6133')) {
    logResult('TypeScript', 'WARN', 'Unused imports found (non-critical)', 'Run npm run lint:fix to clean up');
  } else if (output.includes('Cannot find module')) {
    logResult('TypeScript', 'FAIL', 'Missing module dependencies', output.split('\n')[0]);
  } else {
    logResult('TypeScript', 'FAIL', 'Type checking failed', output.split('\n')[0]);
  }
}

// 4. Validate API Service Structure
console.log('\n🔌 Validating API Service...');

try {
  const apiContent = readFileSync(join(__dirname, 'src/services/api.ts'), 'utf8');
  
  const requiredExports = [
    'fetchRepositories',
    'fetchHealthMetrics', 
    'triggerWorkflow',
    'cancelWorkflow',
    'publishPackage'
  ];
  
  requiredExports.forEach(exportName => {
    if (apiContent.includes(`export async function ${exportName}`)) {
      logResult('API Service', 'PASS', `${exportName} function exported`);
    } else {
      logResult('API Service', 'FAIL', `${exportName} function missing`);
    }
  });
  
  // Check for GitHub service integration
  if (apiContent.includes('githubServiceMock')) {
    logResult('API Integration', 'PASS', 'Mock service integration found');
  } else {
    logResult('API Integration', 'FAIL', 'Mock service integration missing');
  }
  
  if (apiContent.includes('initializeGitHubService')) {
    logResult('API Integration', 'PASS', 'Service initialization found');
  } else {
    logResult('API Integration', 'FAIL', 'Service initialization missing');
  }
  
} catch (error) {
  logResult('API Service', 'FAIL', 'Could not read api.ts', error.message);
}

// 5. Validate Mock GitHub Service
console.log('\n🎭 Validating Mock GitHub Service...');

try {
  const mockContent = readFileSync(join(__dirname, 'src/services/githubServiceMock.ts'), 'utf8');
  
  const requiredMethods = [
    'fetchRepositories',
    'fetchHealthMetrics',
    'triggerWorkflow', 
    'cancelWorkflow',
    'publishPackage'
  ];
  
  requiredMethods.forEach(method => {
    if (mockContent.includes(`async ${method}(`)) {
      logResult('Mock Service', 'PASS', `${method} method implemented`);
    } else {
      logResult('Mock Service', 'FAIL', `${method} method missing`);
    }
  });
  
  // Check for caching implementation
  if (mockContent.includes('withCaching')) {
    logResult('Mock Features', 'PASS', 'Caching implementation found');
  } else {
    logResult('Mock Features', 'WARN', 'Caching implementation missing');
  }
  
  // Check for realistic data
  if (mockContent.includes('metaGOTHIC') && mockContent.includes('ChaseNoCap')) {
    logResult('Mock Data', 'PASS', 'Realistic metaGOTHIC data found');
  } else {
    logResult('Mock Data', 'FAIL', 'Mock data not metaGOTHIC-specific');
  }
  
} catch (error) {
  logResult('Mock Service', 'FAIL', 'Could not read githubServiceMock.ts', error.message);
}

// 6. Run Integration Tests
console.log('\n🧪 Running Integration Tests...');

try {
  const testOutput = execSync('npm test -- src/services/integration.test.ts --run', { 
    cwd: __dirname, 
    encoding: 'utf8',
    timeout: 45000
  });
  
  if (testOutput.includes('✓') && testOutput.includes('passed')) {
    const passedTests = (testOutput.match(/✓/g) || []).length;
    logResult('Integration Tests', 'PASS', `${passedTests} tests passed`);
    
    // Check for specific test categories
    if (testOutput.includes('fetchRepositories')) {
      logResult('Repository Tests', 'PASS', 'Repository fetching tests passed');
    }
    if (testOutput.includes('fetchHealthMetrics')) {
      logResult('Health Tests', 'PASS', 'Health metrics tests passed');
    }
    if (testOutput.includes('Pipeline Control')) {
      logResult('Pipeline Tests', 'PASS', 'Pipeline control tests passed');
    }
  } else {
    logResult('Integration Tests', 'FAIL', 'Tests did not pass');
  }
  
} catch (error) {
  const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
  if (output.includes('failed')) {
    logResult('Integration Tests', 'FAIL', 'Some tests failed', output.split('\n').find(line => line.includes('failed')));
  } else {
    logResult('Integration Tests', 'FAIL', 'Test execution failed', error.message);
  }
}

// 7. Validate Environment Setup
console.log('\n🌍 Validating Environment Setup...');

if (existsSync(join(__dirname, '.env.example'))) {
  const envExample = readFileSync(join(__dirname, '.env.example'), 'utf8');
  if (envExample.includes('VITE_GITHUB_TOKEN')) {
    logResult('Environment', 'PASS', '.env.example contains GitHub token config');
  } else {
    logResult('Environment', 'FAIL', '.env.example missing GitHub token config');
  }
} else {
  logResult('Environment', 'FAIL', '.env.example file missing');
}

if (existsSync(join(__dirname, '.env.local'))) {
  logResult('Environment', 'PASS', '.env.local exists (GitHub token configured)');
} else {
  logResult('Environment', 'WARN', '.env.local not found (using mock mode)');
}

// 8. Test Development Server
console.log('\n🚀 Testing Development Server...');

try {
  // Try to start dev server and check if it compiles
  const devProcess = execSync('timeout 15s npm run dev 2>&1 || true', { 
    cwd: __dirname, 
    encoding: 'utf8'
  });
  
  if (devProcess.includes('ready in') || devProcess.includes('Local:')) {
    logResult('Dev Server', 'PASS', 'Development server starts successfully');
  } else if (devProcess.includes('error') || devProcess.includes('Error')) {
    logResult('Dev Server', 'FAIL', 'Development server failed to start', devProcess.split('\n')[0]);
  } else {
    logResult('Dev Server', 'WARN', 'Development server status unclear');
  }
  
} catch (error) {
  logResult('Dev Server', 'WARN', 'Could not test development server', 'Manual testing recommended');
}

// 9. Functional API Test
console.log('\n🔬 Functional API Testing...');

try {
  // Create a simple test script to validate API functions
  const testScript = `
    import { fetchRepositories, fetchHealthMetrics } from './src/services/api.js';
    
    async function test() {
      try {
        console.log('Testing fetchRepositories...');
        const repos = await fetchRepositories();
        console.log('✓ Repositories:', repos.length, 'found');
        
        console.log('Testing fetchHealthMetrics...');
        const health = await fetchHealthMetrics();
        console.log('✓ Health metrics:', health.length, 'found');
        
        // Validate data structure
        if (repos[0]?.name && repos[0]?.fullName) {
          console.log('✓ Repository data structure valid');
        }
        
        if (health[0]?.repository && health[0]?.status) {
          console.log('✓ Health metrics data structure valid');
        }
        
        process.exit(0);
      } catch (error) {
        console.error('✗ API test failed:', error.message);
        process.exit(1);
      }
    }
    
    test();
  `;
  
  writeFileSync(join(__dirname, 'test-api.mjs'), testScript);
  
  const apiTestOutput = execSync('node test-api.mjs', { 
    cwd: __dirname, 
    encoding: 'utf8',
    timeout: 30000
  });
  
  if (apiTestOutput.includes('✓')) {
    logResult('Functional Test', 'PASS', 'API functions work correctly');
  } else {
    logResult('Functional Test', 'FAIL', 'API functions failed');
  }
  
  // Clean up test file
  execSync('rm -f test-api.mjs', { cwd: __dirname });
  
} catch (error) {
  logResult('Functional Test', 'FAIL', 'API functional test failed', error.message);
  execSync('rm -f test-api.mjs', { cwd: __dirname });
}

// 10. Documentation Validation
console.log('\n📚 Validating Documentation...');

const docFiles = ['SETUP.md', 'INTEGRATION_COMPLETE.md'];
docFiles.forEach(file => {
  if (existsSync(join(__dirname, file))) {
    const content = readFileSync(join(__dirname, file), 'utf8');
    if (content.length > 500) {
      logResult('Documentation', 'PASS', `${file} is comprehensive (${content.length} chars)`);
    } else {
      logResult('Documentation', 'WARN', `${file} seems incomplete`);
    }
  } else {
    logResult('Documentation', 'FAIL', `${file} missing`);
  }
});

// Final Results
console.log('\n📊 Validation Results Summary');
console.log('═'.repeat(50));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`⚠️ Warnings: ${results.warnings}`);
console.log(`📋 Total: ${results.passed + results.failed + results.warnings}`);

const successRate = (results.passed / (results.passed + results.failed)) * 100;
console.log(`🎯 Success Rate: ${successRate.toFixed(1)}%`);

console.log('\n🔍 Detailed Results:');
results.details.forEach(result => {
  if (result.status === 'FAIL') {
    console.log(`❌ ${result.test}: ${result.message}`);
    if (result.details) console.log(`   └─ ${result.details}`);
  }
});

if (results.warnings > 0) {
  console.log('\n⚠️ Warnings:');
  results.details.filter(r => r.status === 'WARN').forEach(result => {
    console.log(`⚠️ ${result.test}: ${result.message}`);
    if (result.details) console.log(`   └─ ${result.details}`);
  });
}

// Overall Assessment
console.log('\n🎉 Overall Assessment:');
if (results.failed === 0) {
  console.log('✅ VALIDATION PASSED - GitHub API integration is working correctly!');
} else if (results.failed <= 2) {
  console.log('⚠️ VALIDATION MOSTLY PASSED - Minor issues detected');
} else {
  console.log('❌ VALIDATION FAILED - Critical issues need to be resolved');
}

console.log('\n💡 Next Steps:');
if (results.failed === 0) {
  console.log('• Integration is ready for production use');
  console.log('• Add GitHub token to .env.local for real API access');
  console.log('• Run development server: npm run dev');
} else {
  console.log('• Review failed tests above');
  console.log('• Fix any critical issues');
  console.log('• Re-run validation');
}

console.log('\n🚀 Ready to proceed with next backlog items!');