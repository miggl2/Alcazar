#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';
const args = process.argv.slice(2);

function resolveNpmCommand() {
  if (process.platform !== 'win32') return { bin: 'npm', prefixArgs: [] };

  const candidates = [
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : '',
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : '',
  ].filter(Boolean);

  const npmCli = candidates.find((candidate) => fs.existsSync(candidate));
  return npmCli ? { bin: process.execPath, prefixArgs: [npmCli] } : { bin: 'npm.cmd', prefixArgs: [] };
}

const npmCommand = resolveNpmCommand();

function usage() {
  console.log(`Usage:
  npm run pages:publish -- --repo https://github.com/OWNER/REPO --name "Git Name" --email "you@example.com"

Options:
  --repo      Required. GitHub repository URL.
  --name      Optional if git user.name is already set.
  --email     Optional if git user.email is already set.
  --message   Optional commit message. Defaults to "Prepare GitHub Pages deploy".
`);
}

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}

function runGit(gitArgs, options = {}) {
  const output = execFileSync(gitBin, gitArgs, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: options.stdio ?? 'pipe',
  });
  return typeof output === 'string' ? output.trim() : '';
}

function fail(message) {
  console.error(`[pages-publish] NO  ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[pages-publish] OK  ${message}`);
}

function normalizeRepoUrl(raw) {
  const value = raw.trim();
  if (!value) return '';

  const httpsMatch = value.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (httpsMatch) return `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}.git`;

  const sshMatch = value.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (sshMatch) return `git@github.com:${sshMatch[1]}/${sshMatch[2]}.git`;

  return '';
}

function gitConfig(key) {
  try {
    return runGit(['config', '--get', key]);
  } catch {
    return '';
  }
}

function setGitConfig(key, value) {
  if (!value) return;
  runGit(['config', key, value]);
}

function hasHead() {
  try {
    runGit(['rev-parse', '--verify', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

function ensureRepo() {
  try {
    runGit(['rev-parse', '--git-dir']);
  } catch {
    runGit(['init']);
  }
}

function ensureMainBranch() {
  runGit(['branch', '-M', 'main']);
  ok('branch main');
}

function ensureIdentity() {
  const nameArg = argValue('--name');
  const emailArg = argValue('--email');
  setGitConfig('user.name', nameArg);
  setGitConfig('user.email', emailArg);

  const name = gitConfig('user.name');
  const email = gitConfig('user.email');
  if (!name || !email) {
    fail('git user.name/user.email missing. Re-run with --name and --email.');
  }

  ok(`git identity: ${name} <${email}>`);
}

function ensureRemote(repoUrl) {
  let current = '';
  try {
    current = runGit(['remote', 'get-url', 'origin']);
  } catch {
    current = '';
  }

  if (!current) {
    runGit(['remote', 'add', 'origin', repoUrl]);
    ok(`origin added: ${repoUrl}`);
    return;
  }

  if (current !== repoUrl) {
    runGit(['remote', 'set-url', 'origin', repoUrl]);
    ok(`origin updated: ${repoUrl}`);
    return;
  }

  ok(`origin already set: ${repoUrl}`);
}

function gitStatusPorcelain() {
  return runGit(['status', '--porcelain']);
}

function commitIfNeeded() {
  runGit(['add', '-A']);
  const status = gitStatusPorcelain();
  if (!status) {
    ok('nothing to commit');
    return;
  }

  const message = argValue('--message') || 'Prepare GitHub Pages deploy';
  runGit(['commit', '-m', message], { stdio: 'inherit' });
  ok('commit created');
}

function runCheck() {
  execFileSync(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'check'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  ok('npm run check');
}

function push() {
  const upstreamArgs = hasHead() ? ['push', '-u', 'origin', 'main'] : ['push', '-u', 'origin', 'main'];
  runGit(upstreamArgs, { stdio: 'inherit' });
  ok('pushed to origin/main');
}

if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const repoUrl = normalizeRepoUrl(argValue('--repo'));
if (!repoUrl) {
  usage();
  fail('valid --repo is required. Example: https://github.com/OWNER/alcazar');
}

if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  fail('run this command from the project root');
}

ensureRepo();
ensureMainBranch();
ensureIdentity();
ensureRemote(repoUrl);
runCheck();
commitIfNeeded();
push();

console.log('[pages-publish] GitHub Pages workflow should start after the push.');
