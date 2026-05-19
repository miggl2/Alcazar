#!/usr/bin/env node
// 배포 전 검증: 공개 URL 설정, 시크릿 노출, 프로덕션 빌드를 확인한다.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';

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

const log = {
  step: (message) => console.log(`\n[deploy] ${message}`),
  ok: (message) => console.log(`  OK  ${message}`),
  fail: (message) => console.log(`  NO  ${message}`),
  warn: (message) => console.log(`  !!  ${message}`),
  info: (message) => console.log(`      ${message}`),
};

let failed = 0;
let warnings = 0;

function fail(message) {
  log.fail(message);
  failed += 1;
}

function warn(message) {
  log.warn(message);
  warnings += 1;
}

function readEnvFile(file) {
  const entries = new Map();
  if (!fs.existsSync(file)) return entries;

  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    entries.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }
  return entries;
}

function readEnvFiles(files) {
  const entries = new Map();
  for (const file of files) {
    const parsed = readEnvFile(file);
    for (const [key, value] of parsed) entries.set(key, value);
  }
  return entries;
}

function envValue(key, envFiles) {
  return process.env[key] || envFiles.get(key) || '';
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function parsePublicUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPlaceholderUrl(rawValue, parsedUrl) {
  const raw = rawValue.toLowerCase();
  const hostname = parsedUrl.hostname.toLowerCase();
  const reservedTlds = ['.example', '.invalid', '.localhost', '.test'];

  return (
    raw.includes('your-domain') ||
    raw.includes('placeholder') ||
    hostname === 'example.com' ||
    hostname === 'example.net' ||
    hostname === 'example.org' ||
    reservedTlds.some((suffix) => hostname.endsWith(suffix))
  );
}

function parseVersion(value) {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compareVersion(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function checkNodeEngine() {
  const pkgText = readText('package.json');
  if (!pkgText) {
    fail('package.json 없음');
    return;
  }

  try {
    const pkg = JSON.parse(pkgText);
    const required = pkg.engines?.node;
    if (typeof required !== 'string') {
      warn('package.json engines.node 없음');
      return;
    }

    const minimum = required.match(/^>=\s*(\d+\.\d+\.\d+)$/)?.[1];
    if (!minimum) {
      warn(`지원하지 않는 engines.node 형식: ${required}`);
      return;
    }

    const currentVersion = process.versions.node;
    const current = parseVersion(currentVersion);
    const min = parseVersion(minimum);
    if (!current || !min) {
      warn(`Node 버전 파싱 실패: current=${currentVersion}, required=${required}`);
      return;
    }

    if (compareVersion(current, min) < 0) {
      fail(`Node ${minimum} 이상 필요, 현재 ${currentVersion}`);
    } else {
      log.ok(`Node ${currentVersion} / 필요 ${required}`);
    }
  } catch {
    fail('package.json 파싱 실패');
  }
}

function hasGit() {
  try {
    execFileSync(gitBin, ['rev-parse', '--git-dir'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Alcazar 배포 전 검증');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const envFile = readEnvFiles(['.env', '.env.local', '.env.production', '.env.production.local']);

log.step('런타임 버전 검사');
checkNodeEngine();

log.step('공개 URL 검사');
const siteUrl = envValue('NEXT_PUBLIC_SITE_URL', envFile);
if (!siteUrl) {
  fail('NEXT_PUBLIC_SITE_URL 없음');
  log.info('출시 도메인을 환경변수로 넣어야 공유/검색 메타데이터가 localhost를 가리키지 않습니다.');
} else if (siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
  fail(`NEXT_PUBLIC_SITE_URL이 로컬 주소입니다: ${siteUrl}`);
} else {
  const parsedSiteUrl = parsePublicUrl(siteUrl);
  if (!parsedSiteUrl) {
    fail(`NEXT_PUBLIC_SITE_URL이 올바른 URL이 아닙니다: ${siteUrl}`);
  } else if (isPlaceholderUrl(siteUrl, parsedSiteUrl)) {
    fail(`NEXT_PUBLIC_SITE_URL이 예시/예약 도메인입니다: ${siteUrl}`);
  } else if (parsedSiteUrl.protocol !== 'https:') {
    warn(`NEXT_PUBLIC_SITE_URL이 HTTPS가 아닙니다: ${siteUrl}`);
  } else {
    log.ok(`공개 URL: ${siteUrl}`);
  }
}

log.step('시크릿 노출 검사');
const envKeys = new Set([...Object.keys(process.env), ...envFile.keys()]);
const exposed = [...envKeys]
  .filter((key) => key.startsWith('NEXT_PUBLIC_'))
  .filter((key) => /SECRET|TOKEN|KEY|PASSWORD/i.test(key.replace('NEXT_PUBLIC_', '')))
  .filter((key) => !/PUBLISHABLE|ANON|API_BASE/i.test(key));

if (exposed.length > 0) {
  fail(`브라우저에 노출될 수 있는 시크릿 이름: ${exposed.join(', ')}`);
} else {
  log.ok('NEXT_PUBLIC_ 시크릿 의심 항목 없음');
}

log.step('git 추적 검사');
if (!hasGit()) {
  warn('git 미초기화 상태입니다.');
} else {
  const tracked = execFileSync(gitBin, ['ls-files', '.env', '.env.local', '.env.production'], {
    stdio: 'pipe',
    encoding: 'utf-8',
  }).trim();

  if (tracked) {
    fail(`환경 파일이 git에 추적되고 있습니다: ${tracked.split('\n').join(', ')}`);
  } else {
    log.ok('환경 파일 git 미추적');
  }
}

log.step('출시 메타 파일 검사');
const manifestPath = 'public/manifest.webmanifest';
const manifestText = readText(manifestPath);
if (!manifestText) {
  fail('public/manifest.webmanifest 없음');
} else {
  try {
    const manifest = JSON.parse(manifestText);
    const missing = ['name', 'short_name', 'start_url', 'display', 'icons'].filter((key) => !(key in manifest));
    if (missing.length) {
      fail(`manifest 필수 항목 누락: ${missing.join(', ')}`);
    } else if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      fail('manifest icons 항목이 비어 있습니다');
    } else if (!manifest.icons.some((icon) => icon?.src === '/app-icon.svg')) {
      fail('manifest가 /app-icon.svg를 가리키지 않습니다');
    } else if (!fs.existsSync('public/app-icon.svg')) {
      fail('manifest 아이콘 파일 public/app-icon.svg 없음');
    } else {
      log.ok('manifest 기본 항목 OK');
    }
  } catch {
    fail('manifest JSON 파싱 실패');
  }
}

const robots = readText('public/robots.txt');
if (!robots) {
  fail('public/robots.txt 없음');
} else if (!/User-agent:\s*\*/i.test(robots) || !/Allow:\s*\//i.test(robots)) {
  warn('robots.txt 기본 허용 규칙 확인 필요');
} else {
  log.ok('robots.txt 기본 규칙 OK');
}

const layout = readText('app/layout.tsx');
const staticOgImage = 'public/play-store/feature-graphic-1024x500.png';
if (!layout.includes("assetPath('/manifest.webmanifest')")) fail('layout metadata manifest 연결 없음');
else log.ok('layout manifest 연결 OK');

if (!layout.includes('/play-store/feature-graphic-1024x500.png')) fail('layout OG 이미지 연결 없음');
else log.ok('layout OG 이미지 연결 OK');

if (!layout.includes('metadataBase: new URL(SITE_URL)')) warn('layout metadataBase 확인 필요');
else log.ok('metadataBase SITE_URL 연결 OK');

if (!fs.existsSync(staticOgImage)) {
  fail('정적 OG 이미지 파일 없음: public/play-store/feature-graphic-1024x500.png');
} else {
  log.ok('정적 OG 이미지 파일 OK');
}

log.step('의존성 보안 감사');
try {
  execFileSync(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'audit:prod'], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  log.ok('프로덕션 의존성 high 이상 취약점 없음');
} catch (error) {
  fail('프로덕션 의존성 보안 감사 실패');
  const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
  if (output) {
    log.info(output.split('\n').slice(0, 24).join('\n'));
  }
}

log.step('프로덕션 빌드');
try {
  execFileSync(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'build'], { stdio: 'inherit' });
  log.ok('빌드 성공');
} catch {
  fail('빌드 실패');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (failed === 0 && warnings === 0) {
  console.log('  배포 준비 통과');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
}

if (failed === 0) {
  console.log(`  ${warnings}개 경고. 배포 전 확인 권장`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
}

console.log(`  ${failed}개 실패, ${warnings}개 경고. 배포 중단`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
process.exit(1);
