#!/usr/bin/env node
// Google Play 제출 직전 남은 빈칸을 한 번에 보여준다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const blockers = [];
const warnings = [];

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function parseEnvFile(file) {
  const entries = new Map();
  const text = read(file);
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    entries.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }
  return entries;
}

function parseEnvFiles(files) {
  const entries = new Map();
  for (const file of files) {
    const parsed = parseEnvFile(file);
    for (const [key, value] of parsed) entries.set(key, value);
  }
  return entries;
}

function envValue(key, envFiles) {
  return process.env[key] || envFiles.get(key) || '';
}

function isPlaceholderUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return true;
  }

  const raw = value.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  return (
    parsed.protocol !== 'https:' ||
    raw.includes('localhost') ||
    raw.includes('127.0.0.1') ||
    raw.includes('your-domain') ||
    raw.includes('placeholder') ||
    host === 'example.com' ||
    host === 'example.net' ||
    host === 'example.org' ||
    host.endsWith('.example') ||
    host.endsWith('.test')
  );
}

function addMissingFileBlocker(file) {
  if (!exists(file)) blockers.push(`필수 파일 없음: ${file}`);
}

function characterLength(value) {
  return Array.from(value.trim()).length;
}

function extractTableValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*(.*?)\\s*\\|`));
  return match?.[1]?.replace(/^`|`$/g, '').trim() || '';
}

function extractCodeBlockAfterHeading(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`##\\s+${escaped}[\\s\\S]*?\`\`\`text\\s*([\\s\\S]*?)\\s*\`\`\``));
  return match?.[1]?.trim() || '';
}

function readPngDimensions(file) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return null;

  const buffer = fs.readFileSync(fullPath);
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== pngSignature) return null;

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    byteLength: buffer.length,
  };
}

function checkExactPng(file, width, height, options = {}) {
  if (!exists(file)) {
    blockers.push(`Play Store 이미지 필요: ${file}`);
    return;
  }

  const dimensions = readPngDimensions(file);
  if (!dimensions) {
    blockers.push(`Play Store 이미지가 PNG가 아니거나 손상됨: ${file}`);
    return;
  }

  if (dimensions.width !== width || dimensions.height !== height) {
    blockers.push(`Play Store 이미지 크기 불일치: ${file} (${dimensions.width}x${dimensions.height}, 필요 ${width}x${height})`);
  }

  if (options.maxBytes && dimensions.byteLength > options.maxBytes) {
    blockers.push(`Play Store 이미지 용량 초과: ${file} (${Math.ceil(dimensions.byteLength / 1024)}KB)`);
  }

  if (options.requiredColorType !== undefined && dimensions.colorType !== options.requiredColorType) {
    blockers.push(`Play Store 이미지 색상 형식 불일치: ${file} (colorType ${dimensions.colorType}, 필요 ${options.requiredColorType})`);
  }

  if (options.requiredBitDepth !== undefined && dimensions.bitDepth !== options.requiredBitDepth) {
    blockers.push(`Play Store 이미지 bit depth 불일치: ${file} (${dimensions.bitDepth}, 필요 ${options.requiredBitDepth})`);
  }
}

function checkPhoneScreenshot(file) {
  if (!exists(file)) {
    blockers.push(`Play Store 이미지 필요: ${file}`);
    return;
  }

  const dimensions = readPngDimensions(file);
  if (!dimensions) {
    blockers.push(`휴대폰 스크린샷이 PNG가 아니거나 손상됨: ${file}`);
    return;
  }

  const min = Math.min(dimensions.width, dimensions.height);
  const max = Math.max(dimensions.width, dimensions.height);
  if (min < 320 || max > 3840) {
    blockers.push(`휴대폰 스크린샷 크기 범위 불일치: ${file} (${dimensions.width}x${dimensions.height})`);
  }
  if (max > min * 2) {
    blockers.push(`휴대폰 스크린샷 비율 불일치: ${file} (${dimensions.width}x${dimensions.height})`);
  }
  if (dimensions.height <= dimensions.width) {
    warnings.push(`휴대폰 스크린샷이 세로형이 아닙니다: ${file} (${dimensions.width}x${dimensions.height})`);
  }
  if (dimensions.colorType === 4 || dimensions.colorType === 6) {
    blockers.push(`휴대폰 스크린샷에는 알파 채널이 없어야 합니다: ${file}`);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Google Play 제출 준비 점검');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const envFiles = parseEnvFiles(['.env', '.env.local', '.env.production', '.env.production.local']);
const siteUrl = envValue('NEXT_PUBLIC_SITE_URL', envFiles);
if (!siteUrl) blockers.push('NEXT_PUBLIC_SITE_URL이 아직 없습니다');
else if (isPlaceholderUrl(siteUrl)) blockers.push(`NEXT_PUBLIC_SITE_URL이 실제 HTTPS 도메인이 아닙니다: ${siteUrl}`);

const pkg = JSON.parse(read('package.json') || '{}');
const nextVersion = String(pkg.dependencies?.next || '');
const nextMajor = Number(nextVersion.match(/\d+/)?.[0] || 0);
if (nextMajor > 0 && nextMajor < 16) {
  blockers.push(`Next ${nextVersion} 사용 중: audit high 취약점 해결 전이라 배포 불가`);
}

for (const file of [
  'docs/PLAY_STORE_LAUNCH.md',
  'docs/PLAY_RELEASE_RUNBOOK.md',
  'docs/PLAY_CONSOLE_VALUES.md',
  'docs/PLAY_DATA_SAFETY.md',
  'docs/PLAY_STORE_LISTING.md',
  'docs/PLAY_STORE_ASSETS.md',
  'public/privacy-policy.html',
]) {
  addMissingFileBlocker(file);
}

const privacy = read('public/privacy-policy.html');
if (privacy.includes('TODO_CONTACT_EMAIL')) blockers.push('privacy-policy.html 연락 이메일이 TODO 상태입니다');

const listing = read('docs/PLAY_STORE_LISTING.md');
if (listing.includes('TODO_CONTACT_EMAIL')) blockers.push('PLAY_STORE_LISTING.md 연락 이메일이 TODO 상태입니다');

const consoleValues = read('docs/PLAY_CONSOLE_VALUES.md');
if (consoleValues.includes('TODO_CONTACT_EMAIL')) blockers.push('PLAY_CONSOLE_VALUES.md 연락 이메일이 TODO 상태입니다');
if (consoleValues.includes('TODO_ANDROID_PACKAGE')) blockers.push('PLAY_CONSOLE_VALUES.md Android 패키지명이 TODO 상태입니다');
if (consoleValues.includes('TODO_SHA256_FINGERPRINT')) blockers.push('PLAY_CONSOLE_VALUES.md SHA-256 fingerprint가 TODO 상태입니다');
if (consoleValues.includes('https://실제-도메인')) blockers.push('PLAY_CONSOLE_VALUES.md 실제 도메인이 TODO 상태입니다');

if (listing) {
  const appName = extractTableValue(listing, '앱 이름');
  const shortDescription = extractCodeBlockAfterHeading(listing, '짧은 설명');
  const fullDescription = extractCodeBlockAfterHeading(listing, '긴 설명');

  if (!appName) blockers.push('PLAY_STORE_LISTING.md 앱 이름을 찾지 못했습니다');
  else if (characterLength(appName) > 30) blockers.push(`앱 이름이 30자를 초과합니다: ${characterLength(appName)}자`);

  if (!shortDescription) blockers.push('PLAY_STORE_LISTING.md 짧은 설명을 찾지 못했습니다');
  else if (characterLength(shortDescription) > 80) {
    blockers.push(`짧은 설명이 80자를 초과합니다: ${characterLength(shortDescription)}자`);
  }

  if (!fullDescription) blockers.push('PLAY_STORE_LISTING.md 긴 설명을 찾지 못했습니다');
  else if (characterLength(fullDescription) > 4000) {
    blockers.push(`긴 설명이 4000자를 초과합니다: ${characterLength(fullDescription)}자`);
  }
}

checkExactPng('public/play-store/icon-512.png', 512, 512, {
  maxBytes: 1024 * 1024,
  requiredBitDepth: 8,
  requiredColorType: 6,
});
checkExactPng('public/play-store/feature-graphic-1024x500.png', 1024, 500, {
  requiredBitDepth: 8,
  requiredColorType: 2,
});
checkPhoneScreenshot('public/play-store/phone-1.png');
checkPhoneScreenshot('public/play-store/phone-2.png');

if (!exists('public/.well-known/assetlinks.json')) {
  blockers.push('public/.well-known/assetlinks.json 없음: Android 서명 SHA-256 확보 후 생성 필요');
} else {
  const assetlinks = read('public/.well-known/assetlinks.json');
  if (/com\.example\.alcazar|AA:BB:CC/.test(assetlinks)) {
    blockers.push('assetlinks.json에 템플릿 값이 남아 있습니다');
  }
}

if (!exists('.git')) {
  warnings.push('git 저장소가 아직 초기화되지 않았습니다');
}

if (blockers.length) {
  console.log('\n막힌 것');
  for (const item of blockers) console.log(`- ${item}`);
}

if (warnings.length) {
  console.log('\n주의');
  for (const item of warnings) console.log(`- ${item}`);
}

if (!blockers.length && !warnings.length) {
  console.log('\n제출 전 점검에서 남은 항목을 찾지 못했습니다.');
}

console.log('\n요약');
console.log(`- 차단: ${blockers.length}`);
console.log(`- 주의: ${warnings.length}`);

process.exitCode = blockers.length ? 1 : 0;
