#!/usr/bin/env node

import express from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.GIT_SERVER_PORT || 3003;


// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, _res, next) => {
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
app.get('/api/git/scan-all', async (_req, res) => {
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

// Enhanced scan with diffs, history, and comprehensive data
app.get('/api/git/scan-all-detailed', async (_req, res) => {
  const metaRoot = path.join(__dirname, '../../..');
  
  try {
    // Get all submodules
    const submodules = await getSubmodules(metaRoot);
    
    // Add the meta repository itself
    const allRepos = [
      { name: 'meta-gothic-framework', path: metaRoot },
      ...submodules
    ];
    
    // Scan all repositories in parallel
    const results = await Promise.all(
      allRepos.map(async (repo) => {
        try {
          const repoData = await getDetailedRepoData(repo.path, repo.name);
          return repoData;
        } catch (error) {
          console.error(`Error scanning ${repo.name}:`, error);
          return {
            name: repo.name,
            path: repo.path,
            error: error.message,
            hasChanges: false
          };
        }
      })
    );
    
    res.json({
      success: true,
      repositories: results,
      scanTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scan all detailed error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get list of all git submodules
app.get('/api/git/submodules', async (_req, res) => {
  const metaRoot = path.join(__dirname, '../../..');
  
  try {
    const submodules = await getSubmodules(metaRoot);
    res.json({
      success: true,
      submodules,
      count: submodules.length
    });
  } catch (error) {
    console.error('Get submodules error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get detailed repository information
app.get('/api/git/repo-details/:repoPath(*)', async (req, res) => {
  const { repoPath } = req.params;
  const resolvedPath = path.resolve(repoPath);
  
  // Security check
  const basePath = path.resolve(path.join(__dirname, '../../..'));
  if (!resolvedPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied: path outside of meta-gothic-framework' });
  }
  
  try {
    const repoName = path.basename(resolvedPath);
    const repoData = await getDetailedRepoData(resolvedPath, repoName);
    
    res.json({
      success: true,
      repository: repoData
    });
  } catch (error) {
    console.error('Get repo details error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Helper function to get submodules
async function getSubmodules(rootPath) {
  try {
    const output = await execGitCommand(rootPath, ['submodule', 'status']);
    
    return output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Parse submodule status line
        // Format: " 74b9e21... packages/ui-components (heads/main)"
        const match = line.match(/^\s*([a-f0-9]+)\s+([^\s]+)\s+\(([^)]+)\)/);
        if (match) {
          return {
            name: path.basename(match[2]),
            path: path.join(rootPath, match[2]),
            hash: match[1],
            ref: match[3]
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Error getting submodules:', error);
    return [];
  }
}

// Helper function to get detailed repository data
async function getDetailedRepoData(repoPath, repoName) {
  // Get git status
  const statusOutput = await execGitCommand(repoPath, ['status', '--porcelain=v1']);
  const files = parseGitStatus(statusOutput);
  
  // Get current branch and tracking info
  const branch = await execGitCommand(repoPath, ['branch', '--show-current']);
  let trackingBranch = '';
  try {
    trackingBranch = await execGitCommand(repoPath, ['rev-parse', '--abbrev-ref', '@{upstream}']);
  } catch (e) {
    // No tracking branch
  }
  
  // Get recent commits
  const logOutput = await execGitCommand(repoPath, [
    'log', '--oneline', '-10', '--pretty=format:%H|%s|%an|%ad', '--date=iso'
  ]);
  const recentCommits = logOutput
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [hash, message, author, date] = line.split('|');
      return { hash: hash.substring(0, 7), message, author, date };
    });
  
  // Get diffs if there are changes
  let stagedDiff = '';
  let unstagedDiff = '';
  
  if (files.some(f => f.staged)) {
    stagedDiff = await execGitCommand(repoPath, ['diff', '--cached']);
  }
  
  if (files.some(f => !f.staged && f.status !== '??')) {
    unstagedDiff = await execGitCommand(repoPath, ['diff']);
  }
  
  // Get new file contents
  const newFiles = files.filter(f => f.status === '??');
  const newFileContents = {};
  
  for (const file of newFiles.slice(0, 5)) { // Limit to 5 files to avoid huge payloads
    try {
      const filePath = path.join(repoPath, file.file);
      const content = await fs.readFile(filePath, 'utf8');
      // Limit content size
      newFileContents[file.file] = content.substring(0, 5000);
    } catch (e) {
      // Ignore read errors
    }
  }
  
  return {
    name: repoName,
    path: repoPath,
    branch: {
      current: branch.trim(),
      tracking: trackingBranch.trim()
    },
    changes: files,
    hasChanges: files.length > 0,
    recentCommits: recentCommits.slice(0, 5), // Limit to 5 commits
    gitDiff: {
      staged: stagedDiff.substring(0, 50000), // Limit size
      unstaged: unstagedDiff.substring(0, 50000)
    },
    newFileContents,
    statistics: {
      totalFiles: files.length,
      stagedFiles: files.filter(f => f.staged).length,
      unstagedFiles: files.filter(f => !f.staged).length,
      additions: files.filter(f => f.status === '??').length,
      modifications: files.filter(f => f.status === 'M' || f.status === 'MM').length,
      deletions: files.filter(f => f.status === 'D').length
    }
  };
}

// Helper function to parse git status output
function parseGitStatus(statusOutput) {
  return statusOutput
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      return {
        file,
        status: status.trim() || '??',
        staged: status[0] !== ' ' && status[0] !== '?',
        unstaged: status[1] !== ' '
      };
    });
}

// Claude API: Generate batch commit messages
app.post('/api/claude/batch-commit-messages', async (req, res) => {
  const { repositories } = req.body;
  
  if (!repositories || !Array.isArray(repositories)) {
    return res.status(400).json({ error: 'Invalid request: repositories array required' });
  }

  try {
    const commitMessages = {};
    
    // Process each repository
    for (const repo of repositories) {
      const prompt = generateCommitMessagePrompt(repo);
      
      try {
        const message = await callClaude(prompt);
        commitMessages[repo.name] = message;
      } catch (error) {
        console.error(`Failed to generate message for ${repo.name}:`, error);
        // Fallback message
        commitMessages[repo.name] = generateFallbackCommitMessage(repo);
      }
    }
    
    res.json({ success: true, commitMessages });
  } catch (error) {
    console.error('Batch commit message generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Claude API: Generate executive summary
app.post('/api/claude/executive-summary', async (req, res) => {
  const { commitMessages } = req.body;
  
  if (!commitMessages || !Array.isArray(commitMessages)) {
    return res.status(400).json({ error: 'Invalid request: commitMessages array required' });
  }

  try {
    const prompt = generateExecutiveSummaryPrompt(commitMessages);
    const summary = await callClaude(prompt);
    
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Executive summary generation error:', error);
    
    // Fallback summary
    const fallbackSummary = generateFallbackExecutiveSummary(commitMessages);
    res.json({ success: true, summary: fallbackSummary });
  }
});

// Helper function to call Claude
async function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const claudePath = process.env.CLAUDE_PATH || 'claude';
    const args = ['--print', '--output-format', 'json'];
    
    const claude = spawn(claudePath, args);
    let output = '';
    let errorOutput = '';
    
    // Send prompt to stdin
    claude.stdin.write(prompt);
    claude.stdin.end();
    
    claude.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    claude.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    claude.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
        return;
      }
      
      try {
        const result = JSON.parse(output);
        resolve(result.content || result.message || output);
      } catch (error) {
        // If not JSON, return raw output
        resolve(output.trim());
      }
    });
    
    claude.on('error', (error) => {
      reject(error);
    });
  });
}

// Helper function to generate commit message prompt
function generateCommitMessagePrompt(repo) {
  const recentCommits = repo.recentCommits
    .slice(0, 5)
    .map(c => `- ${c.message}`)
    .join('\n');
    
  const changes = repo.gitStatus
    .map(f => `${f.status} ${f.file}`)
    .join('\n');
    
  return `Analyze the following git changes and generate a conventional commit message.

Repository: ${repo.name}
Branch: ${repo.branch}

Recent commits for context (to understand commit style):
${recentCommits}

Current changes:
${changes}

${repo.gitDiff.staged ? `Staged diff:\n${repo.gitDiff.staged.substring(0, 5000)}\n` : ''}
${repo.gitDiff.unstaged ? `Unstaged diff:\n${repo.gitDiff.unstaged.substring(0, 5000)}\n` : ''}

${repo.newFileContents ? `New file contents:\n${JSON.stringify(repo.newFileContents, null, 2).substring(0, 5000)}\n` : ''}

Generate a commit message following conventional commit format (feat:, fix:, chore:, docs:, etc).
Focus on the "why" not just the "what". Be concise but descriptive.
DO NOT include any authorship information or sign-offs.
Return only the commit message, nothing else.`;
}

// Helper function to generate executive summary prompt
function generateExecutiveSummaryPrompt(commitMessages) {
  const messages = commitMessages
    .map(cm => `- ${cm.repo}: ${cm.message}`)
    .join('\n');
    
  return `Analyze the following commit messages from multiple repositories and create an executive summary.

Commit Messages:
${messages}

Create a concise executive summary that:
1. Identifies the main themes of changes across all repositories
2. Highlights any cross-repository dependencies or impacts
3. Categorizes changes by type (features, fixes, maintenance, etc.)
4. Provides a high-level overview suitable for stakeholders
5. Notes any potential risks or breaking changes

Format as 3-5 bullet points. Be concise and focus on the most important information.`;
}

// Fallback commit message generation
function generateFallbackCommitMessage(repo) {
  const fileCount = repo.gitStatus.length;
  const types = new Set(repo.gitStatus.map(f => f.status));
  
  let action = 'update';
  if (types.has('??') || types.has('A')) action = 'add';
  else if (types.has('D')) action = 'remove';
  else if (types.has('M')) action = 'update';
  
  return `chore(${repo.name}): ${action} ${fileCount} file${fileCount > 1 ? 's' : ''}`;
}

// Fallback executive summary generation
function generateFallbackExecutiveSummary(commitMessages) {
  const repoCount = commitMessages.length;
  const categories = {
    feat: 0,
    fix: 0,
    chore: 0,
    docs: 0,
    other: 0
  };
  
  commitMessages.forEach(cm => {
    const type = cm.message.split(':')[0];
    if (categories.hasOwnProperty(type)) {
      categories[type]++;
    } else {
      categories.other++;
    }
  });
  
  const summary = [
    `• ${repoCount} repositories have uncommitted changes`,
    `• Change types: ${Object.entries(categories)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ')}`,
    `• Affected repositories: ${commitMessages.map(cm => cm.repo).join(', ')}`
  ];
  
  return summary.join('\n');
}

// Health check
app.get('/api/git/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.1.0',
    features: ['git-operations', 'claude-integration']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Git server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/git/exec - Execute git command');
  console.log('  POST /api/git/status - Get git status for workspace');
  console.log('  GET  /api/git/scan-all - Scan all packages');
  console.log('  GET  /api/git/scan-all-detailed - Deep scan with diffs and history');
  console.log('  GET  /api/git/submodules - List all git submodules');
  console.log('  GET  /api/git/repo-details/:path - Get detailed repository info');
  console.log('  POST /api/claude/batch-commit-messages - Generate AI commit messages');
  console.log('  POST /api/claude/executive-summary - Generate executive summary');
  console.log('  GET  /api/git/health - Health check');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down git server...');
  process.exit(0);
});