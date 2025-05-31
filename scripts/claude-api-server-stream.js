#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.CLAUDE_API_PORT || 3005;

// Session management
const activeSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Execute Claude command with proper streaming
app.post('/api/claude/execute', async (req, res) => {
  const { prompt, sessionId, outputFormat = 'json' } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set up SSE for streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    console.log(`[CLAUDE] Executing prompt: ${prompt.substring(0, 50)}...`);
    
    const newSessionId = sessionId || `session-${Date.now()}`;
    
    // Use spawn with shell:true for better command handling
    const claudeProcess = spawn('claude', [
      '-p',
      prompt,
      '--output-format',
      'json'  // Use regular json, not stream-json
    ], {
      shell: false,  // Don't use shell to avoid escaping issues
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        TERM: 'dumb',
        CI: 'true',
        NO_COLOR: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']  // Ensure we have all pipes
    });
    
    // Close stdin immediately
    claudeProcess.stdin.end();
    
    // Store session info
    activeSessions.set(newSessionId, {
      process: claudeProcess,
      startTime: Date.now(),
      prompt
    });
    
    let outputBuffer = '';
    let errorBuffer = '';
    
    // Handle stdout
    claudeProcess.stdout.on('data', (data) => {
      outputBuffer += data.toString();
      console.log('[CLAUDE] Received data chunk:', data.toString().length, 'bytes');
    });
    
    // Handle stderr
    claudeProcess.stderr.on('data', (data) => {
      errorBuffer += data.toString();
      console.error('[CLAUDE] Stderr:', data.toString());
    });
    
    // Handle process completion
    claudeProcess.on('close', (code) => {
      console.log(`[CLAUDE] Process exited with code ${code}`);
      console.log('[CLAUDE] Total output length:', outputBuffer.length);
      
      if (code === 0 && outputBuffer) {
        try {
          // Parse JSON output
          const jsonData = JSON.parse(outputBuffer.trim());
          
          // Send the result
          res.write(`data: ${JSON.stringify({
            type: 'result',
            result: jsonData.result,
            cost_usd: jsonData.cost_usd,
            duration_ms: jsonData.duration_ms,
            session_id: jsonData.session_id || newSessionId,
            num_turns: jsonData.num_turns || 1
          })}\n\n`);
          
          res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        } catch (parseError) {
          console.error('[CLAUDE] Parse error:', parseError);
          console.error('[CLAUDE] Raw output:', outputBuffer.substring(0, 500));
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            content: `Failed to parse Claude output: ${parseError.message}`
          })}\n\n`);
        }
      } else {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          content: `Claude process failed with code ${code}: ${errorBuffer || 'No error output'}`
        })}\n\n`);
      }
      
      res.end();
      activeSessions.delete(newSessionId);
    });
    
    // Handle errors
    claudeProcess.on('error', (error) => {
      console.error(`[CLAUDE] Process error:`, error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: `Failed to start Claude: ${error.message}`
      })}\n\n`);
      res.end();
      activeSessions.delete(newSessionId);
    });
    
    // Handle client disconnect
    req.on('close', () => {
      console.log('[CLAUDE] Client disconnected');
      if (claudeProcess && !claudeProcess.killed) {
        claudeProcess.kill();
      }
    });
    
  } catch (error) {
    console.error('[CLAUDE] Failed to execute:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      content: error.message 
    })}\n\n`);
    res.end();
  }
});

// Health check
app.get('/api/claude/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeSessions: activeSessions.size,
    uptime: process.uptime()
  });
});

// Test endpoint
app.get('/api/claude/test', async (req, res) => {
  try {
    const testProcess = spawn('claude', ['--version']);
    let output = '';
    
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.on('close', (code) => {
      res.json({
        success: code === 0,
        output: output.trim(),
        code
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude API server (streaming version) running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/claude/execute - Execute Claude command');
  console.log('  GET  /api/claude/health - Health check');
  console.log('  GET  /api/claude/test - Test Claude installation');
});