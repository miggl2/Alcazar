#!/usr/bin/env node
// 실제 Android package name과 SHA-256 fingerprint로 TWA assetlinks.json을 생성한다.
import fs from 'node:fs';
import path from 'node:path';

const [packageName = '', fingerprint = ''] = process.argv.slice(2);
const packagePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

function write(file, text) {
  fs.writeFileSync(path.join(process.cwd(), file), text, 'utf8');
}

if (!packageName || !fingerprint) {
  fail('사용법: npm run assetlinks:write -- com.example.alcazar AA:BB:...:FF');
}

if (!packagePattern.test(packageName)) {
  fail(`Android 패키지명 형식이 올바르지 않습니다: ${packageName}`);
}

if (packageName === 'com.example.alcazar') {
  fail('예시 패키지명은 공개 assetlinks.json에 쓸 수 없습니다');
}

if (!fingerprintPattern.test(fingerprint)) {
  fail('SHA-256 fingerprint는 AA:BB:... 형식의 대문자 32바이트여야 합니다');
}

if (fingerprint.startsWith('AA:BB:CC')) {
  fail('예시 SHA-256 fingerprint는 공개 assetlinks.json에 쓸 수 없습니다');
}

const output = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: [fingerprint],
    },
  },
];

const outDir = path.join(process.cwd(), 'public', '.well-known');
const outFile = path.join(outDir, 'assetlinks.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const consoleValuesFile = 'docs/PLAY_CONSOLE_VALUES.md';
if (fs.existsSync(path.join(process.cwd(), consoleValuesFile))) {
  let consoleValues = read(consoleValuesFile);
  consoleValues = consoleValues.replaceAll('TODO_ANDROID_PACKAGE', packageName);
  consoleValues = consoleValues.replaceAll('TODO_SHA256_FINGERPRINT', fingerprint);
  write(consoleValuesFile, consoleValues);
}

console.log(`assetlinks.json 생성 완료: ${outFile}`);
