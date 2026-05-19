#!/usr/bin/env node
// 출시 도메인과 연락 이메일을 문서/정책 파일에 안전하게 반영한다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const [siteUrl = '', contactEmail = ''] = process.argv.slice(2);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function write(file, text) {
  fs.writeFileSync(path.join(ROOT, file), text, 'utf8');
}

function normalizeSiteUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`도메인 URL 형식이 올바르지 않습니다: ${value}`);
  }

  const raw = value.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  if (
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
  ) {
    fail(`실제 HTTPS 도메인만 사용할 수 있습니다: ${value}`);
  }

  return parsed.origin;
}

function updateEnvExample(normalizedSiteUrl) {
  const file = '.env.example';
  const text = read(file);
  const next = text.replace(/^NEXT_PUBLIC_SITE_URL=.*$/m, `NEXT_PUBLIC_SITE_URL=${normalizedSiteUrl}`);
  write(file, next);
}

function updateReleaseEnv(normalizedSiteUrl) {
  const file = '.env.production';
  const existing = fs.existsSync(path.join(ROOT, file)) ? read(file) : '';
  const line = `NEXT_PUBLIC_SITE_URL=${normalizedSiteUrl}`;
  const next = existing.match(/^NEXT_PUBLIC_SITE_URL=.*$/m)
    ? existing.replace(/^NEXT_PUBLIC_SITE_URL=.*$/m, line)
    : `${existing.trimEnd()}${existing.trim() ? '\n' : ''}${line}\n`;
  write(file, next);
}

function updatePrivacy(contactEmail) {
  const file = 'public/privacy-policy.html';
  const text = read(file);
  const next = text.replace(/Contact email: <code>.*?<\/code>/, `Contact email: <code>${contactEmail}</code>`);
  write(file, next);
}

function updateListing(normalizedSiteUrl, contactEmail) {
  const file = 'docs/PLAY_STORE_LISTING.md';
  let text = read(file);
  text = text.replace(/연락 이메일 \| .*? \|/, `연락 이메일 | ${contactEmail} |`);
  text = text.replace(/개인정보 처리방침 \| `.*?` \|/, `개인정보 처리방침 | \`${normalizedSiteUrl}/privacy-policy.html\` |`);
  text = text.replace(/- `TODO_CONTACT_EMAIL`\r?\n/, '');
  text = text.replace(/- 실제 개인정보 처리방침 URL\r?\n/, '');
  write(file, text);
}

function updateLaunchDocs(normalizedSiteUrl, contactEmail) {
  for (const file of ['docs/PLAY_STORE_LAUNCH.md', 'docs/PLAY_RELEASE_RUNBOOK.md']) {
    let text = read(file);
    text = text.replaceAll('https://실제-도메인', normalizedSiteUrl);
    text = text.replaceAll('https://실제-도메인/', `${normalizedSiteUrl}/`);
    text = text.replaceAll('support@example.com', contactEmail);
    text = text.replaceAll('https://alcazar.example.com', normalizedSiteUrl);
    write(file, text);
  }
}

function updateConsoleValues(normalizedSiteUrl, contactEmail) {
  const file = 'docs/PLAY_CONSOLE_VALUES.md';
  let text = read(file);
  text = text.replace(/연락 이메일 \| .*? \|/, `연락 이메일 | ${contactEmail} |`);
  text = text.replace(/개인정보 처리방침 \| `.*?` \|/, `개인정보 처리방침 | \`${normalizedSiteUrl}/privacy-policy.html\` |`);
  text = text.replace(/Web manifest URL \| `.*?` \|/, `Web manifest URL | \`${normalizedSiteUrl}/manifest.webmanifest\` |`);
  text = text.replace(/공개 URL \| `.*?` \|/, `공개 URL | \`${normalizedSiteUrl}/.well-known/assetlinks.json\` |`);
  text = text.replaceAll('https://실제-도메인', normalizedSiteUrl);
  text = text.replaceAll('support@example.com', contactEmail);
  write(file, text);
}

if (!siteUrl || !contactEmail) {
  fail('사용법: npm run release:info -- https://실제-도메인 support@example.com');
}

const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
if (!emailPattern.test(contactEmail) || contactEmail.endsWith('@example.com')) {
  fail(`연락 이메일 형식이 올바르지 않거나 예시 주소입니다: ${contactEmail}`);
}

updateEnvExample(normalizedSiteUrl);
updateReleaseEnv(normalizedSiteUrl);
updatePrivacy(contactEmail);
updateListing(normalizedSiteUrl, contactEmail);
updateLaunchDocs(normalizedSiteUrl, contactEmail);
updateConsoleValues(normalizedSiteUrl, contactEmail);

console.log('출시 정보 반영 완료');
console.log(`- NEXT_PUBLIC_SITE_URL=${normalizedSiteUrl}`);
console.log(`- 연락 이메일=${contactEmail}`);
