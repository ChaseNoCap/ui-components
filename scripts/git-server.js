#!/usr/bin/env node

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.GIT_SERVER_PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Helper function to safely execute git commands
async function execGitCommand(cwd, args) {
  const command = `git ${args.join(' ')}`;
  console.log(`Executing: ${command} in ${cwd}`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stderr && !stderr.includes('warning:')) {
      console.warn(`Git stderr: ${stderr}`);
    }
    
    return stdout;
  } catch (error) {
    console.error(`Git command failed: ${error.message}`);
    throw new Error(`Git command failed: ${error.message}`);
  }
}

// Execute git command endpoint
app.post('/api/git/exec', async (req, res) => {
  const { cwd, args } = req.body;
  
  if (!cwd || !args || !Array.isArray(args)) {
    return res.status(400).json({ error: 'Invalid request: cwd and args required' });
  }

  // Security: validate cwd is within the meta-gothic-framework
  const resolvedPath = path.resolve(cwd);
  const basePath = path.resolve(path.join(__dirname, '../../..'));
  
  if (!resolvedPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied: path outside of meta-gothic-framework' });
  }

  try {
    const output = await execGitCommand(resolvedPath, args);
    res.text(output);
  } catch (error) {
    res.status(500).text(error.message);
  }
});

// Get git status for a specific workspace
app.post('/api/git/status', async (req, res) => {
  const { workspacePath } = req.body;
  
  // Default to meta-gothic-framework root if no workspace provided
  const targetPath = workspacePath || path.join(__dirname, '../../..');
  const resolvedPath = path.resolve(targetPath);
  
  // Security: validate path is within the meta-gothic-framework
  const basePath = path.resolve(path.join(__dirname, '../../..'));
  
  if (!resolvedPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied: path outside of meta-gothic-framework' });
  }

  try {
    console.log(`Getting git status for workspace: ${resolvedPath}`);
    
    // Get status using porcelain format
    const statusOutput = await execGitCommand(resolvedPath, ['status', '--porcelain=v1']);
    
    res.json({
      success: true,
      output: statusOutput,
      workspacePath: resolvedPath,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Failed to get git status for ${resolvedPath}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      output: '',
      workspacePath: resolvedPath,
      timestamp: new Date().toISOString()
    });
  }
});

// Scan all metaGOTHIC packages for changes
app.get('/api/git/scan-all', async (req, res) => {
  const packagesDir = path.join(__dirname, '../../packages');
  const packages = [
    'claude-client',
    'prompt-toolkit', 
    'sdlc-config',
    'sdlc-engine',
    'sdlc-content',
    'graphql-toolkit',
    'context-aggregator',
    'ui-components'
  ];

  try {
    const results = await Promise.all(
      packages.map(async (pkg) => {
        const pkgPath = path.join(packagesDir, pkg);
        
        try {
          // Get status
          const statusOutput = await execGitCommand(pkgPath, ['status', '--porcelain=v1']);
          const files = statusOutput
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const status = line.substring(0, 2);
              const file = line.substring(3);
              return {
                file,
                status: status.trim() || '??',
                staged: status[0] !== ' ' && status[0] !== '?'
              };
            });

          // Get current branch
          const branch = await execGitCommand(pkgPath, ['branch', '--show-current']);

          return {
            package: pkg,
            path: pkgPath,
            branch: branch.trim(),
            changes: files,
            hasChanges: files.length > 0
          };
        } catch (error) {
          console.error(`Error scanning ${pkg}:`, error);
          return {
            package: pkg,
            path: pkgPath,
            error: error.message,
            hasChanges: false
          };
        }
      })
    );

    res.json(results.filter(r => r.hasChanges || r.error));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate commit messages using Claude Code subprocess
app.post('/api/claude/generate-commit-messages', async (req, res) => {
  const { changes, timestamp } = req.body;
  
  if (!changes || !Array.isArray(changes)) {
    return res.status(400).json({ error: 'Invalid request: changes array required' });
  }

  try {
    console.log(`[CLAUDE] Generating commit messages for ${changes.length} packages`);
    console.log(`[CLAUDE] Input changes structure:`, JSON.stringify(changes, null, 2));
    
    // Prepare the prompt for Claude Code
    const promptData = {
      task: 'generate_commit_messages',
      changes: changes.map(pkg => ({
        package: pkg.package,
        path: pkg.path,
        files: pkg.changes.map(change => ({
          file: change.file,
          status: change.status
        }))
      })),
      context: {
        project: 'meta-gothic-framework',
        timestamp: timestamp
      }
    };

    // Create a temporary prompt file
    const tempPromptPath = path.join(__dirname, '..', 'temp-claude-prompt.json');
    await execAsync(`echo '${JSON.stringify(promptData, null, 2)}' > "${tempPromptPath}"`);

    // Get project backlog for additional context
    const backlogPath = path.join(__dirname, '../../../docs/backlog.md');
    let backlogContext = '';
    try {
      const backlogContent = await execAsync(`head -50 "${backlogPath}" 2>/dev/null || echo "Backlog not available"`);
      backlogContext = backlogContent.stdout || 'Backlog not available';
    } catch (error) {
      backlogContext = 'Backlog not available';
    }

    // Get actual file diffs for better context
    const workspacePath = '/Users/josh/Documents/h1b-visa-analysis/meta-gothic-framework';
    let fileDetails = '';
    try {
      for (const pkg of changes) {
        fileDetails += `\n=== Package: ${pkg.package} ===\n`;
        for (const change of pkg.changes) {
          const fullPath = path.join(workspacePath, pkg.path === '.' ? '' : pkg.path, change.file);
          try {
            if (change.status === 'M') {
              // Get diff for modified files - construct full path from workspace root
              const fullGitPath = pkg.path === '.' ? change.file : `${pkg.path}/${change.file}`;
              console.log(`[CLAUDE] Getting diff for: ${fullGitPath}`);
              const diffOutput = await execAsync(`cd "${workspacePath}" && git diff HEAD -- "${fullGitPath}" | head -20`);
              fileDetails += `\nFile: ${change.file} (Modified)\nRecent changes:\n${diffOutput.stdout || 'No diff available'}\n`;
            } else if (change.status === 'A' || change.status === '??') {
              // Get content preview for new files
              const contentOutput = await execAsync(`head -10 "${fullPath}" 2>/dev/null || echo "New file - content not available"`);
              fileDetails += `\nFile: ${change.file} (New)\nContent preview:\n${contentOutput.stdout || 'Content not available'}\n`;
            } else if (change.status === 'D') {
              fileDetails += `\nFile: ${change.file} (Deleted)\n`;
            }
          } catch (fileError) {
            fileDetails += `\nFile: ${change.file} (${change.status}) - Analysis not available\n`;
          }
        }
      }
    } catch (error) {
      fileDetails = 'File analysis not available';
    }

    // Build comprehensive Claude Code prompt
    const claudePrompt = `
You are analyzing git changes for the metaGOTHIC framework to generate intelligent commit messages.

## PROJECT CONTEXT
The metaGOTHIC framework is an AI-guided development platform that provides:
- Health monitoring dashboards
- CI/CD pipeline control
- Real-time git integration with Claude Code
- Repository management tools

## CURRENT BACKLOG (for context about ongoing work):
${backlogContext}

## FILE CHANGES TO ANALYZE:
${fileDetails}

## CHANGE SUMMARY:
${changes.map(pkg => `
Package: ${pkg.package} (${pkg.path})
Files: ${pkg.changes.map(change => `${change.status} ${change.file}`).join(', ')}
`).join('\n')}

## TASK:
Generate thoughtful commit messages by:

1. **Analyzing the actual code changes** - understand what functionality was added/modified/removed
2. **Considering the project backlog** - see if changes relate to planned work items
3. **Understanding the package purpose** - each package has a specific role in metaGOTHIC
4. **Focusing on user impact** - what does this change enable or improve?

## OUTPUT REQUIREMENTS:
Return a JSON array with objects containing {package, message, description}

- **message**: Concise conventional commit (feat:, fix:, refactor:, docs:, etc.)
- **description**: 1-2 sentences explaining the business value and technical change

## GUIDELINES:
- Use conventional commits format (feat:, fix:, refactor:, docs:, chore:, etc.)
- Focus on WHY and WHAT the change accomplishes, not just WHICH files changed
- Reference backlog items if changes relate to planned work
- Be specific about the functionality added/improved
- Keep messages concise but informative
- Consider the metaGOTHIC framework context

Example good commit:
{
  "package": "ui-components", 
  "message": "feat: implement real-time git status detection with Claude integration",
  "description": "Replaces mock data with live git status API and adds Claude Code subprocess for intelligent commit message generation, enabling real-time repository management in the Tools page."
}

Analyze the changes and generate appropriate commit messages:
`;

    // Execute Claude Code subprocess with file input to avoid stdin issues
    console.log('[CLAUDE] Spawning Claude Code subprocess...');
    const tempPromptFile = path.join(__dirname, '..', 'temp-claude-input.txt');
    
    // Write prompt to temp file
    await execAsync(`cat > "${tempPromptFile}" << 'EOF'
${claudePrompt}
EOF`);
    
    // Execute Claude Code with --print flag for non-interactive use
    const claudeCommand = `claude --print --output-format json < "${tempPromptFile}"`;
    
    const { stdout: claudeOutput } = await execAsync(claudeCommand, {
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      timeout: 30000, // 30 second timeout
      env: { ...process.env, FORCE_COLOR: '0' } // Disable colors for easier parsing
    });

    console.log('[CLAUDE] Raw output:', claudeOutput);

    // Parse Claude's JSON response
    let messages;
    try {
      // Claude --output-format json returns a JSON object with result field
      const claudeResponse = JSON.parse(claudeOutput);
      const responseText = claudeResponse.result || claudeResponse.content || claudeOutput;
      
      console.log('[CLAUDE] Claude response text:', responseText.slice(0, 500));
      
      // Look for JSON array in the response text (may be wrapped in code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        messages = JSON.parse(jsonMatch[0]);
        console.log('[CLAUDE] Successfully parsed commit messages from Claude:', messages.length, 'messages');
      } else {
        throw new Error('No JSON array found in Claude response');
      }
    } catch (parseError) {
      console.warn('[CLAUDE] Failed to parse Claude JSON, generating fallback response:', parseError.message);
      
      // Fallback: generate messages based on Claude's response content
      const claudeResponse = claudeOutput.includes('result') ? 
        JSON.parse(claudeOutput) : { result: claudeOutput };
      const responseText = claudeResponse.result || claudeOutput;
        
      messages = changes.map((pkg, index) => ({
        package: pkg.package,
        message: `refactor: update ${pkg.package} based on Claude analysis`,
        description: `Generated from Claude analysis: ${responseText.slice(0, 200)}...`
      }));
    }

    // Clean up temp files
    try {
      await execAsync(`rm -f "${tempPromptPath}" "${tempPromptFile}"`);
    } catch (cleanupError) {
      console.warn('[CLAUDE] Failed to cleanup temp files:', cleanupError.message);
    }

    console.log('[CLAUDE] Generated messages:', messages);

    res.json({
      success: true,
      messages,
      claudeOutput: claudeOutput.slice(0, 500), // First 500 chars for debugging
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[CLAUDE] Failed to generate commit messages:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/api/git/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Git server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/git/exec - Execute git command');
  console.log('  POST /api/git/status - Get git status for workspace');
  console.log('  GET  /api/git/scan-all - Scan all packages');
  console.log('  POST /api/claude/generate-commit-messages - Generate commit messages via Claude Code');
  console.log('  GET  /api/git/health - Health check');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down git server...');
  process.exit(0);
});