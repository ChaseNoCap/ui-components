#!/usr/bin/env node

import express from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';

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
  // Handle special characters in arguments
  const safeArgs = args.map(arg => {
    // If the argument contains special characters and isn't already quoted, quote it
    if (arg.includes('|') || arg.includes('%') || arg.includes(' ')) {
      if (!arg.startsWith('"') && !arg.startsWith("'")) {
        return arg; // Let the shell handle it naturally
      }
    }
    return arg;
  });
  
  console.log(`Executing: git ${safeArgs.join(' ')} in ${cwd}`);
  
  try {
    // Use spawn instead of exec for better argument handling
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd });
      let stdout = '';
      let stderr = '';
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        } else {
          if (stderr && !stderr.includes('warning:')) {
            console.warn(`Git stderr: ${stderr}`);
          }
          resolve(stdout);
        }
      });
      
      git.on('error', (err) => {
        reject(new Error(`Git command failed: ${err.message}`));
      });
    });
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
            hasChanges: false,
            branch: { current: 'unknown', tracking: '' },
            changes: [],
            recentCommits: [],
            gitDiff: { staged: '', unstaged: '' },
            newFileContents: {},
            statistics: {
              totalFiles: 0,
              stagedFiles: 0,
              unstagedFiles: 0,
              additions: 0,
              modifications: 0,
              deletions: 0
            }
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
    'log', '-10', '--pretty=format:%H|%s|%an|%ad', '--date=iso'
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
      staged: stagedDiff.substring(0, 100000), // Increased limit for better context
      unstaged: unstagedDiff.substring(0, 100000)
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
    const args = ['--print'];
    
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
      
      // Extract just the message content from Claude's output
      const lines = output.trim().split('\n');
      // Filter out any JSON or metadata lines
      const messageLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('"');
      });
      
      resolve(messageLines.join('\n').trim());
    });
    
    claude.on('error', (error) => {
      reject(error);
    });
  });
}

// Helper function to analyze diff content
function analyzeDiffContent(gitDiff) {
  if (!gitDiff || (!gitDiff.staged && !gitDiff.unstaged)) {
    return null;
  }
  
  const allDiffs = (gitDiff.staged || '') + '\n' + (gitDiff.unstaged || '');
  
  // Count additions and deletions
  const additions = (allDiffs.match(/^\+[^+]/gm) || []).length;
  const deletions = (allDiffs.match(/^-[^-]/gm) || []).length;
  
  // Find function/method changes
  const functionChanges = allDiffs.match(/^[+-]\s*(function|const|let|var|class|interface|type|export)\s+\w+/gm) || [];
  const methodChanges = allDiffs.match(/^[+-]\s*\w+\s*\([^)]*\)\s*{/gm) || [];
  
  // Find import changes
  const importChanges = allDiffs.match(/^[+-]\s*import\s+.*/gm) || [];
  
  const summary = [];
  if (additions > 0) summary.push(`${additions} lines added`);
  if (deletions > 0) summary.push(`${deletions} lines deleted`);
  if (functionChanges.length > 0) summary.push(`${functionChanges.length} function/class changes`);
  if (importChanges.length > 0) summary.push(`${importChanges.length} import changes`);
  
  return summary.length > 0 ? summary.join(', ') : null;
}

// Helper function to generate commit message prompt
function generateCommitMessagePrompt(repo) {
  const recentCommits = repo.recentCommits
    .slice(0, 10)
    .map(c => `- ${c.message}`)
    .join('\n');
    
  const changes = repo.gitStatus
    .map(f => `${f.status} ${f.file}`)
    .join('\n');
    
  // Analyze the changes to provide context
  const fileTypes = new Set();
  const modifiedFiles = [];
  const newFiles = [];
  const deletedFiles = [];
  
  repo.gitStatus.forEach(f => {
    const ext = f.file.split('.').pop();
    fileTypes.add(ext);
    
    if (f.status === '??') newFiles.push(f.file);
    else if (f.status === 'D') deletedFiles.push(f.file);
    else modifiedFiles.push(f.file);
  });
  
  // Analyze the actual changes from diffs
  const diffSummary = analyzeDiffContent(repo.gitDiff);
    
  // Group files by directory/component
  const filesByComponent = {};
  repo.gitStatus.forEach(f => {
    const parts = f.file.split('/');
    const component = parts.length > 1 ? parts[0] : 'root';
    if (!filesByComponent[component]) filesByComponent[component] = [];
    filesByComponent[component].push(f.file);
  });
  
  const componentSummary = Object.entries(filesByComponent)
    .map(([comp, files]) => `${comp} (${files.length} files)`)
    .join(', ');

  return `You are a senior developer on the metaGOTHIC team reviewing these changes. Write a commit message that you'd be proud to have in the git history - one that tells the story of this work and helps your teammates understand what you accomplished and why.

Repository: ${repo.name}
Branch: ${repo.branch}

Recent commits from the team (match their style and detail level):
${recentCommits}

Files touched: ${componentSummary}
${changes}

${diffSummary ? `Quick stats: ${diffSummary}` : ''}

THE ACTUAL CODE CHANGES:
${repo.gitDiff.staged ? `
STAGED DIFF:
${repo.gitDiff.staged}
` : ''}
${repo.gitDiff.unstaged ? `
UNSTAGED DIFF:
${repo.gitDiff.unstaged}
` : ''}
${repo.newFileContents && Object.keys(repo.newFileContents).length > 0 ? `
NEW FILES:
${Object.entries(repo.newFileContents).map(([file, content]) => `
=== ${file} ===
${content}
`).join('\n')}
` : ''}

Write a commit message following these STRICT rules:

1. First line: type(scope): concise summary (MUST be under 72 chars)
   - Be specific but brief - save details for bullet points
   - No period at the end

2. Second line: BLANK (required by git)

3. Third line onward: Brief intro (1-2 lines max, each under 80 chars)
   explaining WHY this change was needed

4. Then bullet points with key details:
   • Each bullet point starts with "• " (bullet + space)
   • Each line MUST be under 80 characters (wrap if needed)
   • Include specific function names, components, files
   • Explain what changed and why it matters
   • 3-5 bullet points is ideal

Examples of PROPERLY FORMATTED commit messages:

feat(navigation): add Tools dropdown menu for better organization

The Tools page was becoming unwieldy with too many features. Created a
dropdown menu to organize repository management tools more effectively.

• Added dropdown with Repository Status, Manual Commit, Change Review
• Implemented mobile-responsive behavior with touch support
• Used click-outside detection and proper ARIA labels for a11y
• Integrated with existing routing - all paths under /tools/*
• Fixed theme context issues in Tools components

fix(git-server): prevent path traversal vulnerability in git operations

Critical security issue where paths could escape project root. This could
have allowed access to system files outside the meta-gothic-framework.

• Added path.resolve() + startsWith() validation on all endpoints
• Reject any paths that try to escape meta-gothic-framework root
• Fixed submodule detection treating regular directories as submodules
• Increased diff size limits from 50KB to 100KB for large refactors
• Added proper error messages for path validation failures

refactor(changeReview): extract git operations to dedicated service

The ChangeReview component had too many responsibilities, making it hard
to test and maintain. Separated concerns for better architecture.

• Moved all git operations to new ChangeReviewService class
• Implemented proper TypeScript interfaces for all data types
• Added comprehensive error handling with user-friendly messages
• Created progressive loading states (scanning → generating → complete)
• Prepared codebase for future WebSocket real-time updates

REMEMBER:
- First line under 72 chars
- All other lines under 80 chars
- Blank line after first line
- Brief intro explaining WHY
- Bullet points with specific details
- Write like you're helping future developers understand this change

Write your commit message below:`;
}

// Helper function to generate executive summary prompt
function generateExecutiveSummaryPrompt(commitMessages) {
  const messages = commitMessages
    .map(cm => `- ${cm.repo}: ${cm.message}`)
    .join('\n');
  
  // Group commits by type
  const commitTypes = {};
  commitMessages.forEach(cm => {
    const match = cm.message.match(/^(\w+)(\(.+?\))?:/);
    const type = match ? match[1] : 'other';
    if (!commitTypes[type]) commitTypes[type] = [];
    commitTypes[type].push(cm);
  });
  
  const typesSummary = Object.entries(commitTypes)
    .map(([type, commits]) => `${type}: ${commits.length} commit${commits.length > 1 ? 's' : ''}`)
    .join(', ');
    
  return `Create a concise executive summary of the following development work across the metaGOTHIC framework.

Repositories with changes (${commitMessages.length} total):
${messages}

Commit type distribution: ${typesSummary}

Generate an executive summary that:
1. Provides a HIGH-LEVEL overview suitable for stakeholders
2. Groups related changes into themes (e.g., "UI Enhancements", "API Improvements", "Bug Fixes")
3. Highlights the BUSINESS VALUE and USER IMPACT of changes
4. Identifies any cross-repository dependencies or impacts
5. Notes any significant technical improvements or risks

Format as 3-5 concise bullet points using markdown. Each bullet should be a complete thought that stands alone.
Focus on WHAT was accomplished and WHY it matters, not technical implementation details.

Example format:
• Enhanced developer experience with new repository management tools in the UI
• Improved system reliability by fixing critical path resolution issues
• Expanded API capabilities to support real-time status monitoring

Return ONLY the bullet points, no introduction or explanations.`;
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

// Commit changes in a repository
app.post('/api/git/commit', async (req, res) => {
  const { repoPath, message } = req.body;
  
  console.log('Commit request received:', { repoPath, message });
  
  if (!repoPath || !message) {
    return res.status(400).json({ error: 'Invalid request: repoPath and message required' });
  }
  
  const resolvedPath = path.resolve(repoPath);
  
  // Security check
  const basePath = path.resolve(path.join(__dirname, '../../..'));
  if (!resolvedPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied: path outside of meta-gothic-framework' });
  }
  
  try {
    console.log(`Committing changes in ${resolvedPath} with message: ${message}`);
    
    // Check if there are any changes to commit
    const statusOutput = await execGitCommand(resolvedPath, ['status', '--porcelain=v1']);
    if (!statusOutput.trim()) {
      return res.json({
        success: false,
        error: 'No changes to commit',
        repository: path.basename(resolvedPath)
      });
    }
    
    // Add all changes
    const files = statusOutput.split('\n').filter(line => line.trim());
    for (const fileLine of files) {
      const status = fileLine.substring(0, 2).trim();
      const file = fileLine.substring(3);
      
      // Check if this is a submodule (modified submodule shows as 'M' with gitlink mode)
      // We can detect submodules by checking if it's a directory in packages/
      const fullPath = path.join(resolvedPath, file);
      const isSubmodule = file.startsWith('packages/') && 
                          fsSync.existsSync(fullPath) && 
                          fsSync.statSync(fullPath).isDirectory();
      
      if (!isSubmodule) {
        console.log(`Adding file: ${file} (status: ${status})`);
        await execGitCommand(resolvedPath, ['add', file]);
      } else {
        console.log(`Adding submodule reference: ${file}`);
        // For submodules, we need to add them differently
        await execGitCommand(resolvedPath, ['add', file]);
      }
    }
    
    // Check if we have anything staged
    const stagedOutput = await execGitCommand(resolvedPath, ['diff', '--cached', '--name-only']);
    if (!stagedOutput.trim()) {
      return res.json({
        success: false,
        error: 'No changes staged for commit (submodules must be committed separately)',
        repository: path.basename(resolvedPath)
      });
    }
    
    // Then commit with the message
    const commitOutput = await execGitCommand(resolvedPath, ['commit', '-m', message]);
    
    res.json({
      success: true,
      output: commitOutput,
      repository: path.basename(resolvedPath)
    });
  } catch (error) {
    console.error('Commit error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Batch commit multiple repositories
app.post('/api/git/batch-commit', async (req, res) => {
  const { commits } = req.body;
  
  if (!commits || !Array.isArray(commits)) {
    return res.status(400).json({ error: 'Invalid request: commits array required' });
  }
  
  // Sort commits to ensure submodules are committed before parent repos
  const sortedCommits = [...commits].sort((a, b) => {
    // If a is in packages/ and b is not, a comes first
    if (a.repoPath.includes('/packages/') && !b.repoPath.includes('/packages/')) return -1;
    // If b is in packages/ and a is not, b comes first
    if (!a.repoPath.includes('/packages/') && b.repoPath.includes('/packages/')) return 1;
    // Otherwise maintain original order
    return 0;
  });
  
  console.log('Sorted commits order:', sortedCommits.map(c => path.basename(c.repoPath)));
  
  const results = [];
  
  for (const commit of sortedCommits) {
    const { repoPath, message } = commit;
    const resolvedPath = path.resolve(repoPath);
    
    // Security check
    const basePath = path.resolve(path.join(__dirname, '../../..'));
    if (!resolvedPath.startsWith(basePath)) {
      results.push({
        repository: path.basename(repoPath),
        success: false,
        error: 'Access denied: path outside of meta-gothic-framework'
      });
      continue;
    }
    
    try {
      console.log(`Committing changes in ${resolvedPath}`);
      
      // Check if there are any changes to commit
      const statusOutput = await execGitCommand(resolvedPath, ['status', '--porcelain=v1']);
      if (!statusOutput.trim()) {
        results.push({
          repository: path.basename(resolvedPath),
          success: false,
          error: 'No changes to commit'
        });
        continue;
      }
      
      // Add all changes
      const files = statusOutput.split('\n').filter(line => line.trim());
      for (const fileLine of files) {
        const status = fileLine.substring(0, 2).trim();
        const file = fileLine.substring(3);
        
        // Check if this is a submodule (modified submodule shows as 'M' with gitlink mode)
        // We can detect submodules by checking if it's a directory in packages/
        const fullPath = path.join(resolvedPath, file);
        const isSubmodule = file.startsWith('packages/') && 
                            fsSync.existsSync(fullPath) && 
                            fsSync.statSync(fullPath).isDirectory();
        
        if (!isSubmodule) {
          console.log(`Adding file: ${file} (status: ${status})`);
          await execGitCommand(resolvedPath, ['add', file]);
        } else {
          console.log(`Adding submodule reference: ${file}`);
          // For submodules, we need to add them differently
          await execGitCommand(resolvedPath, ['add', file]);
        }
      }
      
      // Check if we have anything staged
      const stagedOutput = await execGitCommand(resolvedPath, ['diff', '--cached', '--name-only']);
      if (!stagedOutput.trim()) {
        results.push({
          repository: path.basename(resolvedPath),
          success: false,
          error: 'No changes staged for commit (submodules must be committed separately)'
        });
        continue;
      }
      
      // Commit with the message
      const commitOutput = await execGitCommand(resolvedPath, ['commit', '-m', message]);
      
      results.push({
        repository: path.basename(resolvedPath),
        success: true,
        output: commitOutput
      });
      
      // If we just committed a submodule, update the parent repo's git status
      if (resolvedPath.includes('/packages/')) {
        const parentPath = path.resolve(path.join(resolvedPath, '../..'));
        console.log(`Submodule committed, checking parent repo at ${parentPath}`);
        
        // Check if parent has the submodule as a change
        try {
          const parentStatus = await execGitCommand(parentPath, ['status', '--porcelain=v1']);
          const submoduleName = path.basename(resolvedPath);
          const hasSubmoduleChange = parentStatus.includes(`packages/${submoduleName}`);
          
          if (hasSubmoduleChange) {
            console.log(`Parent repo has submodule change for ${submoduleName}, will be included in next commit`);
          }
        } catch (e) {
          console.log('Could not check parent status:', e.message);
        }
      }
    } catch (error) {
      console.error(`Commit error for ${path.basename(resolvedPath)}:`, error);
      results.push({
        repository: path.basename(resolvedPath),
        success: false,
        error: error.message
      });
    }
  }
  
  res.json({
    success: results.every(r => r.success),
    results
  });
});

// Push changes in a repository
app.post('/api/git/push', async (req, res) => {
  const { repoPath } = req.body;
  
  if (!repoPath) {
    return res.status(400).json({ error: 'Invalid request: repoPath required' });
  }
  
  const resolvedPath = path.resolve(repoPath);
  
  // Security check
  const basePath = path.resolve(path.join(__dirname, '../../..'));
  if (!resolvedPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied: path outside of meta-gothic-framework' });
  }
  
  try {
    console.log(`Pushing changes in ${resolvedPath}`);
    
    // Get current branch
    const branch = await execGitCommand(resolvedPath, ['branch', '--show-current']);
    const currentBranch = branch.trim();
    
    // Push to origin
    const pushOutput = await execGitCommand(resolvedPath, ['push', 'origin', currentBranch]);
    
    res.json({
      success: true,
      output: pushOutput,
      repository: path.basename(resolvedPath),
      branch: currentBranch
    });
  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Batch push multiple repositories
app.post('/api/git/batch-push', async (req, res) => {
  const { repositories } = req.body;
  
  if (!repositories || !Array.isArray(repositories)) {
    return res.status(400).json({ error: 'Invalid request: repositories array required' });
  }
  
  const results = [];
  
  for (const repoPath of repositories) {
    const resolvedPath = path.resolve(repoPath);
    
    // Security check
    const basePath = path.resolve(path.join(__dirname, '../../..'));
    if (!resolvedPath.startsWith(basePath)) {
      results.push({
        repository: path.basename(repoPath),
        success: false,
        error: 'Access denied: path outside of meta-gothic-framework'
      });
      continue;
    }
    
    try {
      console.log(`Pushing changes in ${resolvedPath}`);
      
      // Get current branch
      const branch = await execGitCommand(resolvedPath, ['branch', '--show-current']);
      const currentBranch = branch.trim();
      
      // Push to origin
      const pushOutput = await execGitCommand(resolvedPath, ['push', 'origin', currentBranch]);
      
      results.push({
        repository: path.basename(resolvedPath),
        success: true,
        output: pushOutput,
        branch: currentBranch
      });
    } catch (error) {
      console.error(`Push error for ${path.basename(resolvedPath)}:`, error);
      results.push({
        repository: path.basename(resolvedPath),
        success: false,
        error: error.message
      });
    }
  }
  
  res.json({
    success: results.every(r => r.success),
    results
  });
});

// Get all repositories with status
app.get('/api/git/all-status', async (_req, res) => {
  const metaRoot = path.join(__dirname, '../../..');
  
  try {
    // Get all submodules
    const submodules = await getSubmodules(metaRoot);
    
    // Add the meta repository itself
    const allRepos = [
      { name: 'meta-gothic-framework', path: metaRoot },
      ...submodules
    ];
    
    // Get status for all repositories
    const results = await Promise.all(
      allRepos.map(async (repo) => {
        try {
          // Get status
          const statusOutput = await execGitCommand(repo.path, ['status', '--porcelain=v1']);
          const hasChanges = statusOutput.trim().length > 0;
          
          // Get current branch
          const branch = await execGitCommand(repo.path, ['branch', '--show-current']);
          
          // Get ahead/behind counts
          let ahead = 0, behind = 0;
          try {
            const revListAhead = await execGitCommand(repo.path, ['rev-list', '--count', '@{u}..HEAD']);
            const revListBehind = await execGitCommand(repo.path, ['rev-list', '--count', 'HEAD..@{u}']);
            ahead = parseInt(revListAhead.trim()) || 0;
            behind = parseInt(revListBehind.trim()) || 0;
          } catch (e) {
            // Remote might not exist
          }
          
          // Get last commit
          const lastCommitInfo = await execGitCommand(repo.path, [
            'log', '-1', '--pretty=format:%H|%s|%an|%ad', '--date=iso'
          ]);
          const [hash, message, author, date] = lastCommitInfo.trim().split('|');
          
          // Count uncommitted changes
          const uncommittedChanges = statusOutput.trim().split('\n').filter(line => line).length;
          
          return {
            name: repo.name,
            path: repo.path,
            branch: branch.trim(),
            status: hasChanges ? 'dirty' : 'clean',
            ahead,
            behind,
            lastCommit: {
              hash,
              message,
              author,
              date
            },
            uncommittedChanges
          };
        } catch (error) {
          return {
            name: repo.name,
            path: repo.path,
            branch: 'unknown',
            status: 'error',
            ahead: 0,
            behind: 0,
            lastCommit: {
              hash: '',
              message: '',
              author: '',
              date: ''
            },
            uncommittedChanges: 0,
            error: error.message
          };
        }
      })
    );
    
    res.json({
      success: true,
      repositories: results
    });
  } catch (error) {
    console.error('Get all status error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get list of repositories
app.get('/api/git/repositories', async (_req, res) => {
  const metaRoot = path.join(__dirname, '../../..');
  
  try {
    // Get all submodules
    const submodules = await getSubmodules(metaRoot);
    
    // Add the meta repository itself
    const allRepos = [
      { name: 'meta-gothic-framework', path: metaRoot },
      ...submodules
    ];
    
    // Check each repository for changes
    const results = await Promise.all(
      allRepos.map(async (repo) => {
        try {
          const statusOutput = await execGitCommand(repo.path, ['status', '--porcelain=v1']);
          const hasChanges = statusOutput.trim().length > 0;
          
          return {
            name: repo.name,
            path: repo.path,
            hasChanges
          };
        } catch (error) {
          return {
            name: repo.name,
            path: repo.path,
            hasChanges: false,
            error: error.message
          };
        }
      })
    );
    
    res.json({
      success: true,
      repositories: results
    });
  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get status for a specific repository (query param)
app.get('/api/git/status', async (req, res) => {
  const { path: repoPath } = req.query;
  
  if (!repoPath) {
    return res.status(400).json({ error: 'Repository path required' });
  }
  
  const resolvedPath = path.resolve(repoPath);
  
  // Security check
  const basePath = path.resolve(path.join(__dirname, '../../..'));
  if (!resolvedPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied: path outside of meta-gothic-framework' });
  }
  
  try {
    // Get status
    const statusOutput = await execGitCommand(resolvedPath, ['status', '--porcelain=v1']);
    
    // Parse file changes
    const files = statusOutput
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2);
        const filePath = line.substring(3);
        
        // Map git status codes to our format
        let changeType = 'modified';
        if (status.includes('A') || status === '??') changeType = 'added';
        if (status.includes('D')) changeType = 'deleted';
        
        return {
          path: filePath,
          status: changeType,
          additions: 0, // Would need git diff to get these
          deletions: 0
        };
      });
    
    res.json({
      success: true,
      files,
      repository: path.basename(resolvedPath)
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Health check
app.get('/api/git/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.1.0',
    features: ['git-operations', 'claude-integration', 'commit-management', 'push-support']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Git server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/git/exec - Execute git command');
  console.log('  POST /api/git/status - Get git status for workspace');
  console.log('  GET  /api/git/status - Get status for a specific repository');
  console.log('  GET  /api/git/scan-all - Scan all packages');
  console.log('  GET  /api/git/scan-all-detailed - Deep scan with diffs and history');
  console.log('  GET  /api/git/all-status - Get status for all repositories');
  console.log('  GET  /api/git/repositories - List all repositories');
  console.log('  GET  /api/git/submodules - List all git submodules');
  console.log('  GET  /api/git/repo-details/:path - Get detailed repository info');
  console.log('  POST /api/git/commit - Commit changes in a repository');
  console.log('  POST /api/git/batch-commit - Commit changes in multiple repositories');
  console.log('  POST /api/git/push - Push changes in a repository');
  console.log('  POST /api/git/batch-push - Push changes in multiple repositories');
  console.log('  POST /api/claude/batch-commit-messages - Generate AI commit messages');
  console.log('  POST /api/claude/executive-summary - Generate executive summary');
  console.log('  GET  /api/git/health - Health check');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down git server...');
  process.exit(0);
});