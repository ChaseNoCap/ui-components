#!/usr/bin/env node

// Direct Claude execution script
// This runs outside the main server to avoid nested Claude issues

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const prompt = process.argv.slice(2).join(' ');

if (!prompt) {
  console.error('Usage: node claude-direct.js <prompt>');
  process.exit(1);
}

async function executeClaude() {
  try {
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const command = `claude -p '${escapedPrompt}' --output-format json`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
      env: {
        ...process.env,
        FORCE_COLOR: '0'
      }
    });
    
    if (stderr) {
      console.error('STDERR:', stderr);
    }
    
    console.log(stdout);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

executeClaude();