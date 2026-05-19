#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/alcazar';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example-user.github.io/alcazar';

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

function fail(message) {
  console.error(`[pages-check] NO  ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`[pages-check] OK  ${message}`);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf-8');
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function runBuild() {
  const env = {
    ...process.env,
    GITHUB_PAGES: 'true',
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
    NEXT_PUBLIC_SITE_URL: SITE_URL,
  };

  execFileSync(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'build'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
}

function checkWorkflow() {
  const workflow = '.github/workflows/github-pages.yml';
  if (!exists(workflow)) {
    fail(`${workflow} missing`);
    return;
  }

  const content = read(workflow);
  const required = [
    'actions/configure-pages@v5',
    'actions/upload-pages-artifact@v3',
    'actions/deploy-pages@v4',
    'GITHUB_PAGES=true',
    'NEXT_PUBLIC_BASE_PATH',
    'NEXT_PUBLIC_SITE_URL',
  ];

  const missing = required.filter((item) => !content.includes(item));
  if (missing.length) fail(`${workflow} missing: ${missing.join(', ')}`);
  else ok('GitHub Pages workflow');
}

function checkOutFiles() {
  const required = [
    'out/index.html',
    'out/404.html',
    'out/.nojekyll',
    'out/manifest.webmanifest',
    'out/app-icon.svg',
    'out/play-store/icon-512.png',
    'out/play-store/feature-graphic-1024x500.png',
  ];

  const missing = required.filter((file) => !exists(file));
  if (missing.length) fail(`missing exported files: ${missing.join(', ')}`);
  else ok('required exported files');
}

function checkHtml() {
  const html = read('out/index.html');
  const expectedManifest = `${BASE_PATH}/manifest.webmanifest`;
  const expectedOg = `${SITE_URL.replace(/\/$/, '')}/play-store/feature-graphic-1024x500.png`;

  if (!html.includes(`href="${expectedManifest}"`)) fail(`manifest link is not ${expectedManifest}`);
  else ok('manifest link uses base path');

  if (!html.includes(expectedOg)) fail(`OG image is not ${expectedOg}`);
  else ok('static OG image URL');

  if (html.includes('/opengraph-image')) fail('old dynamic opengraph-image route is still referenced');
  else ok('no dynamic opengraph-image route');

  const assetUrls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith(`${BASE_PATH}/`));

  const missing = [];
  for (const url of new Set(assetUrls)) {
    const withoutBase = url.slice(BASE_PATH.length + 1).split('?')[0];
    if (!exists(path.join('out', withoutBase))) missing.push(url);
  }

  if (missing.length) fail(`exported asset links missing files: ${missing.join(', ')}`);
  else ok(`${new Set(assetUrls).size} base-path asset links`);
}

function checkManifest() {
  const manifest = JSON.parse(read('out/manifest.webmanifest'));
  const iconSources = new Set((manifest.icons || []).map((icon) => icon.src));

  if (manifest.start_url !== '.') fail('manifest start_url should be "."');
  else ok('manifest start_url');

  if (manifest.scope !== '.') fail('manifest scope should be "."');
  else ok('manifest scope');

  if (!iconSources.has('play-store/icon-512.png')) fail('manifest missing 512 PNG icon');
  else ok('manifest 512 PNG icon');
}

console.log('[pages-check] GitHub Pages static export check');
checkWorkflow();
runBuild();
checkOutFiles();
checkHtml();
checkManifest();

if (process.exitCode) {
  console.error('[pages-check] failed');
  process.exit(process.exitCode);
}

console.log('[pages-check] passed');
