#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.CLAUDE_API_PORT || 3005;

// Session management
const activeSessions = new Map();
const sessionTimeouts = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Helper to clean up session
const cleanupSession = (sessionId) => {
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    if (session.process && !session.process.killed) {
      session.process.kill();
    }
    activeSessions.delete(sessionId);
  }
  
  if (sessionTimeouts.has(sessionId)) {
    clearTimeout(sessionTimeouts.get(sessionId));
    sessionTimeouts.delete(sessionId);
  }
};

// Helper to reset session timeout
const resetSessionTimeout = (sessionId) => {
  if (sessionTimeouts.has(sessionId)) {
    clearTimeout(sessionTimeouts.get(sessionId));
  }
  
  const timeout = setTimeout(() => {
    console.log(`[CLAUDE] Session ${sessionId} timed out`);
    cleanupSession(sessionId);
  }, SESSION_TIMEOUT);
  
  sessionTimeouts.set(sessionId, timeout);
};

// Execute Claude command with streaming
app.post('/api/claude/execute', async (req, res) => {
  const { prompt, sessionId, outputFormat = 'stream-json', options = {} } = req.body;
  
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
    console.log(`[CLAUDE] Executing prompt for session: ${sessionId || 'new'}`);
    
    // Build command arguments
    const args = [];
    
    // Always use print mode for non-interactive
    args.push('-p');
    
    // Add the actual prompt first
    args.push(prompt);
    
    // Add output format
    args.push('--output-format', outputFormat);
    
    // Handle session continuation
    if (sessionId && activeSessions.has(sessionId)) {
      args.push('--resume', sessionId);
      resetSessionTimeout(sessionId);
    } else if (options.continue) {
      args.push('--continue');
    }
    
    // Add system prompt if provided
    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }
    
    console.log(`[CLAUDE] Command: claude ${args.join(' ')}`);
    
    // Store session info
    const newSessionId = sessionId || `session-${Date.now()}`;
    
    // Execute claude using exec with proper escaping
    try {
      // Escape the prompt for shell
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      // Write prompt to a file to avoid shell escaping issues
      const tempFile = path.join(__dirname, '..', `.claude-prompt-${Date.now()}.txt`);
      await fs.writeFile(tempFile, prompt);
      
      console.log('[CLAUDE] Using file input for prompt');
      
      // Store session
      activeSessions.set(newSessionId, {
        process: null,
        startTime: Date.now(),
        prompt
      });
      resetSessionTimeout(newSessionId);
      
      // Send starting message
      res.write(`data: ${JSON.stringify({
        type: 'message',
        role: 'system',
        content: 'Executing Claude command...'
      })}\n\n`);
      
      // Execute and stream response
      const startTime = Date.now();
      
      try {
        // Use spawn instead of exec for better control
        const claudeProcess = spawn('claude', [
          '-p',
          `@${tempFile}`,  // Use @ to read from file
          '--output-format',
          'json'
        ], {
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            TERM: 'dumb',
            CI: 'true',
            CLAUDE_NO_INTERACTIVE: 'true'
          },
          stdio: ['ignore', 'pipe', 'pipe']  // Ignore stdin
        });
        
        let stdout = '';
        let stderr = '';
        
        claudeProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        claudeProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        claudeProcess.on('close', async (code) => {
          // Clean up temp file
          try {
            await fs.unlink(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }
          
          if (code !== 0) {
            throw new Error(`Claude exited with code ${code}: ${stderr}`);
          }
        
          if (stderr) {
            console.error('[CLAUDE] Stderr:', stderr);
          }
          
          console.log('[CLAUDE] Raw output:', stdout);
          
          // Parse the JSON output
          const jsonData = JSON.parse(stdout);
          
          // Send the result
          res.write(`data: ${JSON.stringify({
            type: 'result',
            result: jsonData.result,
            cost_usd: jsonData.cost_usd,
            duration_ms: Date.now() - startTime,
            session_id: jsonData.session_id || newSessionId,
            num_turns: jsonData.num_turns || 1
          })}\n\n`);
          
          res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
          res.end();
        });
        
        claudeProcess.on('error', (error) => {
          console.error('[CLAUDE] Process error:', error);
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            content: `Failed to start Claude: ${error.message}`
          })}\n\n`);
          res.end();
        });
        
      } catch (execError) {
        console.error('[CLAUDE] Execution error:', execError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          content: `Claude execution failed: ${execError.message}`
        })}\n\n`);
        res.end();
      }
      
      return;
    } catch (error) {
      console.error('[CLAUDE] Setup error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: error.message 
      })}\n\n`);
      res.end();
      return;
    }
    
    // The following is the original streaming code - keeping for reference
    /* 
    // Store session info (already declared above)
    activeSessions.set(newSessionId, {
      process: claudeProcess,
      startTime: Date.now(),
      prompt
    });
    resetSessionTimeout(newSessionId);
    
    // Buffer for incomplete JSON lines
    let buffer = '';
    
    // Handle stdout (streaming JSON)
    claudeProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        console.log(`[CLAUDE] Output line: ${line}`);
        
        try {
          const jsonData = JSON.parse(line);
          
          // Add session ID to response
          if (jsonData.type === 'result') {
            jsonData.session_id = jsonData.session_id || newSessionId;
          }
          
          // Send as SSE
          res.write(`data: ${JSON.stringify(jsonData)}\n\n`);
        } catch (e) {
          console.error(`[CLAUDE] Failed to parse JSON: ${e.message}, line: ${line}`);
          // Send raw line if not JSON
          res.write(`data: ${JSON.stringify({ type: 'raw', content: line })}\n\n`);
        }
      }
    });
    
    // Handle stderr
    claudeProcess.stderr.on('data', (data) => {
      console.error(`[CLAUDE] Error:`, data.toString());
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: data.toString() 
      })}\n\n`);
    });
    
    // Handle process completion
    claudeProcess.on('close', (code) => {
      console.log(`[CLAUDE] Process exited with code ${code}`);
      
      // Send completion event
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        code,
        session_id: newSessionId
      })}\n\n`);
      
      res.end();
      
      // Don't cleanup session immediately - allow for continuation
      if (code !== 0) {
        cleanupSession(newSessionId);
      }
    });
    
    // Handle errors
    claudeProcess.on('error', (error) => {
      console.error(`[CLAUDE] Process error:`, error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: error.message 
      })}\n\n`);
      res.end();
      cleanupSession(newSessionId);
    });
    
    // Handle client disconnect
    req.on('close', () => {
      console.log('[CLAUDE] Client disconnected');
      // Don't kill the process - allow session to persist
    });
    */
    
  } catch (error) {
    console.error('[CLAUDE] Failed to execute:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      content: error.message 
    })}\n\n`);
    res.end();
  }
});

// Continue existing session
app.post('/api/claude/continue', async (req, res) => {
  const { sessionId, prompt } = req.body;
  
  if (!sessionId || !prompt) {
    return res.status(400).json({ error: 'Session ID and prompt are required' });
  }
  
  // Reuse the execute endpoint with session ID
  req.body.options = { ...req.body.options, continue: true };
  return app._router.handle(req, res);
});

// Get session info
app.get('/api/claude/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!activeSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const session = activeSessions.get(sessionId);
  res.json({
    sessionId,
    active: true,
    startTime: session.startTime,
    duration: Date.now() - session.startTime,
    prompt: session.prompt
  });
});

// List active sessions
app.get('/api/claude/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
    sessionId: id,
    startTime: session.startTime,
    duration: Date.now() - session.startTime,
    prompt: session.prompt.substring(0, 100) + '...'
  }));
  
  res.json({ sessions });
});

// Kill a session
app.delete('/api/claude/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!activeSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  cleanupSession(sessionId);
  res.json({ success: true, message: 'Session terminated' });
});

// Save session state
app.post('/api/claude/sessions/:sessionId/state', async (req, res) => {
  const { sessionId } = req.params;
  const { state } = req.body;
  
  if (!state) {
    return res.status(400).json({ error: 'State is required' });
  }
  
  try {
    const stateDir = path.join(__dirname, '..', '.claude-states');
    await fs.mkdir(stateDir, { recursive: true });
    
    const stateFile = path.join(stateDir, `${sessionId}.json`);
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    
    res.json({ success: true, message: 'State saved' });
  } catch (error) {
    console.error('[CLAUDE] Failed to save state:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load session state
app.get('/api/claude/sessions/:sessionId/state', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const stateFile = path.join(__dirname, '..', '.claude-states', `${sessionId}.json`);
    const state = await fs.readFile(stateFile, 'utf8');
    res.json(JSON.parse(state));
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'State not found' });
    } else {
      console.error('[CLAUDE] Failed to load state:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Create handoff document
app.post('/api/claude/handoff', async (req, res) => {
  const { sessionId, summary } = req.body;
  
  if (!summary) {
    return res.status(400).json({ error: 'Summary is required' });
  }
  
  try {
    // Execute Claude to create handoff
    const args = ['-p'];
    
    if (sessionId && activeSessions.has(sessionId)) {
      args.push('--resume', sessionId);
    } else {
      args.push('--continue');
    }
    
    args.push(`Please create a handoff document with the following summary: ${summary}`);
    
    const result = await new Promise((resolve, reject) => {
      let output = '';
      const process = spawn('claude', args, {
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      
      process.on('error', reject);
    });
    
    res.json({ handoff: result });
  } catch (error) {
    console.error('[CLAUDE] Failed to create handoff:', error);
    res.status(500).json({ error: error.message });
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

// Test endpoint for SSE
app.get('/api/claude/test-sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send test messages
  res.write(`data: ${JSON.stringify({ type: 'message', content: 'Starting test...' })}\n\n`);
  
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: 'message', content: 'Processing...' })}\n\n`);
  }, 1000);
  
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: 'result', result: 'Hello! This is a test response.', cost_usd: 0.001 })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();
  }, 2000);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n[CLAUDE] Shutting down server...');
  
  // Kill all active sessions
  for (const [sessionId, session] of activeSessions) {
    if (session.process && !session.process.killed) {
      session.process.kill();
    }
  }
  
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/claude/execute - Execute Claude command with streaming');
  console.log('  POST /api/claude/continue - Continue existing session');
  console.log('  GET  /api/claude/sessions - List active sessions');
  console.log('  GET  /api/claude/sessions/:id - Get session info');
  console.log('  DELETE /api/claude/sessions/:id - Kill session');
  console.log('  GET  /api/claude/health - Health check');
});