#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.CLAUDE_API_PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mock responses for testing when API key is not available
const MOCK_MODE = !process.env.ANTHROPIC_API_KEY;

// Execute Claude command
app.post('/api/claude/execute', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set up SSE for streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sessionId = `session-${Date.now()}`;
  
  try {
    if (MOCK_MODE) {
      // Mock mode for testing
      console.log('[CLAUDE] Running in mock mode (no API key)');
      
      res.write(`data: ${JSON.stringify({
        type: 'message',
        role: 'system',
        content: 'Running in mock mode. Set ANTHROPIC_API_KEY to use real Claude API.'
      })}\n\n`);
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({
          type: 'result',
          result: `Mock response to: "${prompt}"\n\nThis is a test response. To use real Claude:\n1. Set ANTHROPIC_API_KEY environment variable\n2. Restart the server`,
          cost_usd: 0.001,
          duration_ms: 500,
          session_id: sessionId,
          num_turns: 1
        })}\n\n`);
        
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
      }, 1000);
    } else {
      // Real API mode
      console.log('[CLAUDE] Using Anthropic API directly');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      
      res.write(`data: ${JSON.stringify({
        type: 'result',
        result: data.content[0].text,
        cost_usd: (data.usage.input_tokens * 0.000003 + data.usage.output_tokens * 0.000015),
        duration_ms: 1000,
        session_id: sessionId,
        num_turns: 1
      })}\n\n`);
      
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[CLAUDE] Error:', error);
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
    mode: MOCK_MODE ? 'mock' : 'api',
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude API server (direct mode) running on http://localhost:${PORT}`);
  console.log(`Mode: ${MOCK_MODE ? 'MOCK (no API key)' : 'REAL API'}`);
  if (MOCK_MODE) {
    console.log('To use real Claude API, set ANTHROPIC_API_KEY environment variable');
  }
});