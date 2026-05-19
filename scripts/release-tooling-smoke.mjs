#!/usr/bin/env node
// 출시 정보 반영 도구를 실제 repo가 아닌 임시 폴더에서 검증한다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const NODE = process.execPath;

function copyFile(relativePath, tempRoot) {
  const source = path.join(ROOT, relativePath);
  const target = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function read(tempRoot, relativePath) {
  return fs.readFileSync(path.join(tempRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(tempRoot, script, args, options = {}) {
  try {
    execFileSync(NODE, [script, ...args], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (options.expectFailure) throw new Error(`${script}가 실패해야 하는데 성공했습니다`);
  } catch (error) {
    if (!options.expectFailure) {
      const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
      throw new Error(`${script} 실패: ${output || error.message}`);
    }
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alcazar-release-smoke-'));

try {
  for (const file of [
    'scripts/set-release-info.mjs',
    'scripts/write-assetlinks.mjs',
    'docs/PLAY_CONSOLE_VALUES.md',
    'docs/PLAY_STORE_LAUNCH.md',
    'docs/PLAY_RELEASE_RUNBOOK.md',
    'docs/PLAY_STORE_LISTING.md',
    'public/privacy-policy.html',
    '.env.example',
  ]) {
    copyFile(file, tempRoot);
  }

  run(tempRoot, 'scripts/set-release-info.mjs', ['https://alcazar.example.com', 'support@example.com'], {
    expectFailure: true,
  });
  run(
    tempRoot,
    'scripts/write-assetlinks.mjs',
    [
      'com.example.alcazar',
      '11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:11:22',
    ],
    { expectFailure: true }
  );

  run(tempRoot, 'scripts/set-release-info.mjs', ['https://alcazar-release-check.dev', 'support@alcazar-release-check.dev']);

  assert(read(tempRoot, '.env.production').includes('NEXT_PUBLIC_SITE_URL=https://alcazar-release-check.dev'), '출시 env 갱신 실패');
  assert(read(tempRoot, 'public/privacy-policy.html').includes('support@alcazar-release-check.dev'), 'privacy 연락처 갱신 실패');
  assert(read(tempRoot, 'docs/PLAY_STORE_LISTING.md').includes('https://alcazar-release-check.dev/privacy-policy.html'), 'listing URL 갱신 실패');
  assert(read(tempRoot, 'docs/PLAY_CONSOLE_VALUES.md').includes('https://alcazar-release-check.dev/manifest.webmanifest'), 'console manifest URL 갱신 실패');

  const packageName = 'com.alcazar.releasecheck';
  const fingerprint = '11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:11:22';
  run(tempRoot, 'scripts/write-assetlinks.mjs', [packageName, fingerprint]);

  const assetlinks = read(tempRoot, 'public/.well-known/assetlinks.json');
  const consoleValues = read(tempRoot, 'docs/PLAY_CONSOLE_VALUES.md');
  assert(assetlinks.includes(packageName), 'assetlinks package name 갱신 실패');
  assert(assetlinks.includes(fingerprint), 'assetlinks fingerprint 갱신 실패');
  assert(consoleValues.includes(packageName), 'console package name 갱신 실패');
  assert(consoleValues.includes(fingerprint), 'console fingerprint 갱신 실패');
  assert(!consoleValues.includes('TODO_ANDROID_PACKAGE'), 'console Android package TODO 잔존');
  assert(!consoleValues.includes('TODO_SHA256_FINGERPRINT'), 'console SHA TODO 잔존');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('release tooling smoke OK');
