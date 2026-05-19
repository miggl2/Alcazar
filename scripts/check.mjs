#!/usr/bin/env node
// 완료 전 안전 체크 — 타입, 시크릿, 디자인 텔, 작업 장부를 검사한다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
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
  step: (message) => console.log(`\n🔍 ${message}`),
  ok: (message) => console.log(`  ✅ ${message}`),
  fail: (message) => console.log(`  ❌ ${message}`),
  warn: (message) => console.log(`  ⚠️  ${message}`),
  info: (message) => console.log(`     ${message}`),
};

let failed = 0;
let warnings = 0;
const specialistReasons = new Set();

function fail(message) {
  log.fail(message);
  failed += 1;
}

function warn(message) {
  log.warn(message);
  warnings += 1;
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function read(file) {
  return fs.readFileSync(file, 'utf-8');
}

function runFile(bin, args, name, options = {}) {
  try {
    execFileSync(bin, args, { stdio: 'pipe', encoding: 'utf-8' });
    log.ok(name);
    return true;
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    if (options.warnOnly) warn(`${name} 경고`);
    else fail(`${name} 실패`);
    if (output) log.info(output.split('\n').slice(0, 10).join('\n'));
    return false;
  }
}

function git(args, options = {}) {
  const { raw = false, ...execOptions } = options;
  const output = execFileSync(gitBin, args, {
    stdio: 'pipe',
    encoding: 'utf-8',
    ...execOptions,
  });
  return raw ? output : output.trim();
}

function hasGit() {
  try {
    git(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

function hasHead() {
  try {
    git(['rev-parse', '--verify', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

function changedFiles() {
  if (!hasGit()) return [];
  let status = '';
  try {
    status = git(['status', '--porcelain'], { raw: true });
  } catch {
    return [];
  }

  return status
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/.* -> /, '').trim())
    .filter(Boolean);
}

function isBookkeepingFile(file) {
  return file === 'STATE.md' || file.startsWith('.intent/');
}

function walkFiles(dir, options = {}) {
  const skipDirs = new Set(
    options.skipDirs ?? ['node_modules', '.next', '.git', 'dist', 'build', '.intent', '.snapshots', 'coverage']
  );
  const result = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(path.join(current, entry.name));
        continue;
      }

      const file = path.join(current, entry.name);
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      if (options.include && !options.include(rel)) continue;
      if (options.exclude && options.exclude(rel)) continue;
      result.push(file);
    }
  }

  walk(dir);
  return result;
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  안전 체크 시작');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const gitReady = hasGit();
const headReady = hasHead();

log.step('TypeScript 타입 검사');
exists('tsconfig.json')
  ? runFile(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'typecheck'], 'typecheck')
  : warn('tsconfig.json 없음 — 스킵');

log.step('Node 스크립트 문법 검사');
const scriptFiles = walkFiles(path.join(ROOT, 'scripts'), {
  include: (rel) => rel.startsWith('scripts/') && /\.mjs$/.test(rel),
});
let scriptSyntaxFailures = 0;
for (const file of scriptFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe', encoding: 'utf-8' });
  } catch (error) {
    scriptSyntaxFailures += 1;
    fail(`${path.relative(ROOT, file)} 문법 오류`);
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    if (output) log.info(output.split('\n').slice(0, 8).join('\n'));
  }
}
if (scriptSyntaxFailures === 0) log.ok('scripts/*.mjs 문법 OK');

log.step('코드 스타일 검사');
exists('.eslintrc.json')
  ? runFile(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'lint'], 'lint')
  : warn('.eslintrc.json 없음 — 스킵');

log.step('퍼즐 생성 스모크 테스트');
exists('scripts/generator-smoke.mjs')
  ? runFile(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'smoke'], 'generator smoke')
  : warn('scripts/generator-smoke.mjs 없음 — 스킵');

log.step('출시 도구 스모크 테스트');
exists('scripts/release-tooling-smoke.mjs')
  ? runFile(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'release:smoke'], 'release tooling smoke')
  : warn('scripts/release-tooling-smoke.mjs 없음 — 스킵');

log.step('GitHub Pages 정적 배포 검사');
exists('scripts/github-pages-check.mjs')
  ? runFile(npmCommand.bin, [...npmCommand.prefixArgs, 'run', 'pages:check'], 'github pages static export')
  : warn('scripts/github-pages-check.mjs 없음 — 스킵');

log.step('시크릿 노출 검사');
const secretSkipFiles = new Set(['package-lock.json', '.env.example']);
const secretPatterns = [
  { name: 'OpenAI 키', regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'Anthropic 키', regex: /sk-ant-[a-zA-Z0-9_-]{20,}/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Google API 키', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'Slack Webhook', regex: /hooks\.slack\.com\/services\/T[A-Z0-9]/ },
  { name: 'Postgres URL', regex: /postgres(?:ql)?:\/\/[^\s'"`]+:[^\s'"`]+@/ },
];
let secretsFound = 0;
for (const file of walkFiles(ROOT, {
  include: (rel) => /\.(ts|tsx|js|jsx|mjs|json|env|md|css)$/.test(rel),
  exclude: (rel) => secretSkipFiles.has(path.basename(rel)) || rel.startsWith('docs/'),
})) {
  let content = '';
  try {
    content = read(file);
  } catch {
    continue;
  }
  for (const { name, regex } of secretPatterns) {
    if (regex.test(content)) {
      fail(`${path.relative(ROOT, file)}에 ${name} 패턴 발견`);
      secretsFound += 1;
    }
  }
}
if (secretsFound === 0) log.ok('시크릿 패턴 없음');

log.step('.env 파일 git 추적 검사');
if (gitReady) {
  try {
    const tracked = git(['ls-files', '.env', '.env.local', '.env.production']);
    tracked ? fail(`.env가 git에 추적됨: ${tracked}`) : log.ok('.env 안전 (git 추적 안 됨)');
  } catch {
    warn('.env git 추적 확인 실패');
  }
} else {
  warn('git 미초기화 — .env 추적 검사는 스킵');
}

const changed = changedFiles().filter((file) => !isBookkeepingFile(file));

log.step('변경 파일 수 검사');
if (gitReady) {
  if (changed.length > 5) {
    if (!headReady) {
      warn(`${changed.length}개 파일 변경됨 — 첫 커밋 전 초기 세팅으로 판단하여 실패 처리하지 않음`);
    } else if (confirmationOk()) {
      specialistReasons.add('5개 초과 파일 변경');
      warn(`${changed.length}개 파일 변경됨 — 사용자 확인 기록은 있으나 작업 분할 권장`);
    } else {
      specialistReasons.add('5개 초과 파일 변경');
      fail(`${changed.length}개 파일 변경됨 — 5개 이하로 쪼개거나 사용자 확인 기록 필요`);
    }
  } else {
    log.ok(`${changed.length}개 파일 변경 (안전 범위)`);
  }
} else {
  warn('git 미초기화 — 변경 파일 수 검사는 스킵');
}

log.step('작업 장부(.intent) 검사');
if (changed.length > 0) {
  const required = [
    '.intent/current.md',
    '.intent/plan.md',
    '.intent/checklist.md',
    '.intent/changed-files.md',
    '.intent/user-confirmation.md',
  ];
  const missing = required.filter((file) => !exists(file));
  if (missing.length) {
    headReady ? fail(`작업 장부 누락: ${missing.join(', ')}`) : warn(`첫 커밋 전 작업 장부 누락: ${missing.join(', ')}`);
  } else {
    log.ok('작업 장부 파일 존재');
  }

  if (headReady && !confirmationOk()) fail('코드 변경이 있지만 사용자 확인 기록이 없음');

  if (exists('.intent/changed-files.md')) {
    const record = read(path.join(ROOT, '.intent/changed-files.md'));
    const notRecorded = changed.filter((file) => !record.includes(file));
    if (notRecorded.length && !headReady) {
      warn('첫 커밋 전 초기 세팅 — changed-files.md 전체 파일 대조를 완화함');
    } else if (notRecorded.length) {
      warn(`changed-files.md에 기록되지 않은 수정 파일: ${notRecorded.slice(0, 5).join(', ')}`);
    }
    else log.ok('수정 파일 기록 일치');
  }
} else {
  log.ok('변경 파일 없음 — 작업 장부 검사 생략');
}

log.step('환경변수 누락 검사');
function envExampleEntries() {
  const example = read(path.join(ROOT, '.env.example'));
  return example
    .split('\n')
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return {
        key: line.slice(0, index).trim(),
        value: line.slice(index + 1).trim(),
      };
    })
    .filter((entry) => entry.key);
}

if (exists('.env.example') && exists('.env')) {
  const requiredKeys = envExampleEntries().map((entry) => entry.key);
  const env = read(path.join(ROOT, '.env'));
  const envKeys = new Set(
    env
      .split('\n')
      .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => line.split('=')[0].trim())
  );
  const missing = requiredKeys.filter((key) => !envKeys.has(key));
  missing.length ? warn(`.env에 누락된 키 ${missing.length}개: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`) : log.ok('환경변수 매칭 OK');
} else if (exists('.env.example') && !exists('.env')) {
  const blankDefaults = envExampleEntries().filter((entry) => !entry.value);
  if (blankDefaults.length) {
    warn(`.env 파일 없음 — 기본값 없는 키 ${blankDefaults.length}개: ${blankDefaults.slice(0, 3).map((entry) => entry.key).join(', ')}`);
  } else {
    log.ok('.env 없음 — 로컬 기본값은 .env.example에 있고 배포 값은 deploy-check에서 검사');
  }
} else {
  warn('.env.example 없음');
}

log.step('AI티 카피/디자인 검사');
const uiFiles = walkFiles(ROOT, { include: (rel) => /^(app|components)\/.*\.(tsx|ts|jsx|js|css)$/.test(rel) });
const forbidden = [
  { name: '당신의 여정', regex: /당신의\s*여정/ },
  { name: '원활한 경험', regex: /원활한\s*경험/ },
  { name: '혁신적인/차세대/혁명적인', regex: /(혁신적인|차세대|혁명적인)/ },
  { name: 'Unleash/Seamless/Empower', regex: /(Unleash|Seamless experience|Empower your)/i },
  { name: '보라/인디고/바이올렛 그라데이션', regex: /(from|to|via)-(purple|indigo|violet)-\d{2,3}/ },
  { name: '과한 글래스 효과', regex: /(glassmorphism|\bglass\b|backdrop-blur)/ },
  { name: '이모지 헤더 남발', regex: /[✨🚀💫]{2,}/u },
];
let styleHits = 0;
for (const file of uiFiles) {
  const content = read(file);
  for (const item of forbidden) {
    if (item.regex.test(content)) {
      fail(`${path.relative(ROOT, file)}에서 금지 패턴 발견: ${item.name}`);
      styleHits += 1;
    }
  }
}
if (styleHits === 0) log.ok('금지 카피/디자인 패턴 없음');

log.step('앱 visible text 회귀 검사');
let visibleTextHits = 0;
const visibleTextRegex = /[A-Za-z가-힣]/;

function jsxAttrText(attribute) {
  if (!attribute.initializer) return '';
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    ts.isStringLiteral(attribute.initializer.expression)
  ) {
    return attribute.initializer.expression.text;
  }
  return '';
}

function hasSrOnlyAncestor(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    const opening = ts.isJsxElement(current)
      ? current.openingElement
      : ts.isJsxSelfClosingElement(current)
        ? current
        : null;

    if (opening) {
      for (const property of opening.attributes.properties) {
        if (ts.isJsxAttribute(property) && property.name.text === 'className' && jsxAttrText(property).includes('sr-only')) {
          return true;
        }
      }
    }
    current = current.parent;
  }
  return false;
}

for (const file of uiFiles.filter((candidate) => /\.(tsx|jsx)$/.test(candidate))) {
  const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const sourceText = read(file);
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (node.kind === ts.SyntaxKind.JsxText) {
      const text = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (text && visibleTextRegex.test(text) && !hasSrOnlyAncestor(node)) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        fail(`${rel}:${position.line + 1} visible text 발견: ${text}`);
        visibleTextHits += 1;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}
if (visibleTextHits === 0) log.ok('보이는 JSX 텍스트 없음');

log.step('Google Play 준비 파일 검사');
const playRequiredFiles = [
  'docs/PLAY_STORE_LAUNCH.md',
  'docs/PLAY_RELEASE_RUNBOOK.md',
  'docs/NEXT16_UPGRADE_PLAN.md',
  'docs/PLAY_CONSOLE_VALUES.md',
  'docs/PLAY_DATA_SAFETY.md',
  'docs/PLAY_STORE_LISTING.md',
  'docs/PLAY_STORE_ASSETS.md',
  'docs/ASSETLINKS_TEMPLATE.json',
  'public/privacy-policy.html',
];
let playReadinessHits = 0;

for (const file of playRequiredFiles) {
  if (!exists(file)) {
    fail(`Google Play 준비 파일 없음: ${file}`);
    playReadinessHits += 1;
  }
}

if (exists('public/privacy-policy.html')) {
  const privacyPolicy = read(path.join(ROOT, 'public/privacy-policy.html'));
  if (!privacyPolicy.includes('Alcazar Privacy Policy')) {
    fail('privacy-policy.html 제목 확인 실패');
    playReadinessHits += 1;
  }

  if (privacyPolicy.includes('TODO_CONTACT_EMAIL')) {
    warn('privacy-policy.html 연락 이메일이 TODO 상태입니다');
  }
}

if (exists('docs/ASSETLINKS_TEMPLATE.json')) {
  try {
    const template = JSON.parse(read(path.join(ROOT, 'docs/ASSETLINKS_TEMPLATE.json')));
    const target = template?.[0]?.target;
    const fingerprint = target?.sha256_cert_fingerprints?.[0] || '';
    if (target?.namespace !== 'android_app') {
      fail('ASSETLINKS_TEMPLATE namespace 확인 실패');
      playReadinessHits += 1;
    }
    if (!target?.package_name || !Array.isArray(target.sha256_cert_fingerprints)) {
      fail('ASSETLINKS_TEMPLATE 필수 항목 누락');
      playReadinessHits += 1;
    }
    if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)) {
      fail('ASSETLINKS_TEMPLATE SHA-256 형식 확인 실패');
      playReadinessHits += 1;
    }
  } catch {
    fail('ASSETLINKS_TEMPLATE JSON 파싱 실패');
    playReadinessHits += 1;
  }
}

if (exists('docs/PLAY_STORE_LISTING.md')) {
  const listing = read(path.join(ROOT, 'docs/PLAY_STORE_LISTING.md'));
  const requiredListingText = ['짧은 설명', '긴 설명', '앱 아이콘', '피처 그래픽', '휴대폰 스크린샷'];
  const missingListingText = requiredListingText.filter((item) => !listing.includes(item));
  if (missingListingText.length) {
    fail(`PLAY_STORE_LISTING.md 필수 항목 누락: ${missingListingText.join(', ')}`);
    playReadinessHits += 1;
  }
  if (listing.includes('TODO_CONTACT_EMAIL')) {
    warn('PLAY_STORE_LISTING.md 연락 이메일이 TODO 상태입니다');
  }
}

if (exists('docs/PLAY_RELEASE_RUNBOOK.md')) {
  const runbook = read(path.join(ROOT, 'docs/PLAY_RELEASE_RUNBOOK.md'));
  const requiredRunbookText = ['API level 35', '12명의 테스터', '14일 연속', 'Bubblewrap', 'assetlinks'];
  const missingRunbookText = requiredRunbookText.filter((item) => !runbook.includes(item));
  if (missingRunbookText.length) {
    fail(`PLAY_RELEASE_RUNBOOK.md 필수 항목 누락: ${missingRunbookText.join(', ')}`);
    playReadinessHits += 1;
  }
}

if (exists('docs/PLAY_STORE_ASSETS.md')) {
  const assets = read(path.join(ROOT, 'docs/PLAY_STORE_ASSETS.md'));
  const requiredAssetText = ['icon-512.png', 'feature-graphic-1024x500.png', 'phone-1.png', 'phone-2.png'];
  const missingAssetText = requiredAssetText.filter((item) => !assets.includes(item));
  if (missingAssetText.length) {
    fail(`PLAY_STORE_ASSETS.md 필수 이미지 항목 누락: ${missingAssetText.join(', ')}`);
    playReadinessHits += 1;
  }
}

if (exists('docs/PLAY_CONSOLE_VALUES.md')) {
  const consoleValues = read(path.join(ROOT, 'docs/PLAY_CONSOLE_VALUES.md'));
  const requiredConsoleText = ['앱 생성', '스토어 등록', 'Data safety', 'Bubblewrap', 'Digital Asset Links'];
  const missingConsoleText = requiredConsoleText.filter((item) => !consoleValues.includes(item));
  if (missingConsoleText.length) {
    fail(`PLAY_CONSOLE_VALUES.md 필수 항목 누락: ${missingConsoleText.join(', ')}`);
    playReadinessHits += 1;
  }
}

if (exists('public/.well-known/assetlinks.json')) {
  const assetlinks = read(path.join(ROOT, 'public/.well-known/assetlinks.json'));
  if (/com\.example\.alcazar|AA:BB:CC/.test(assetlinks)) {
    fail('공개 assetlinks.json에 템플릿 값이 남아 있습니다');
    playReadinessHits += 1;
  }
}

if (playReadinessHits === 0) log.ok('Google Play 준비 파일 존재');

log.step('패키지 변경 검사');
const packageChanged = changed.some((file) => file === 'package.json' || file === 'package-lock.json');
if (!exists('package-lock.json')) {
  fail('package-lock.json 없음 — 재현 가능한 설치 불가');
} else {
  log.ok('package-lock.json 존재');
}

if (exists('package.json')) {
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  const loose = [];
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = pkg[section] || {};
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version !== 'string') continue;
      const registryPackage = !version.startsWith('file:') && !version.startsWith('workspace:') && !version.startsWith('link:');
      if (registryPackage && !version.startsWith('~')) loose.push(`${name}@${version}`);
    }
  }
  loose.length ? fail(`느슨한 패키지 버전 발견: ${loose.join(', ')}`) : log.ok('패키지 버전이 ~ 범위로 고정됨');
}

if (packageChanged && headReady) {
  specialistReasons.add('패키지 변경');
  const checks = [exists('.intent/package-checks.md') ? read(path.join(ROOT, '.intent/package-checks.md')) : '', exists('.intent/context.md') ? read(path.join(ROOT, '.intent/context.md')) : ''].join('\n');
  /npm view\s+[@\w./-]+/i.test(checks) ? log.ok('패키지 검증 기록 존재') : warn('패키지 변경이 있으나 npm view 검증 기록이 없음');
} else if (!packageChanged) {
  log.ok('패키지 변경 없음');
} else {
  warn('첫 커밋 전 패키지 변경으로 보임 — 초기 세팅이면 정상');
}

log.step('shell 실행 패턴 검사');
const shellScanFiles = walkFiles(ROOT, { include: (rel) => /\.(ts|tsx|js|jsx|mjs)$/.test(rel) });
let shellPatternHits = 0;
const suspiciousShellPatterns = [
  /(?:exec|execSync)\s*\(\s*`[\s\S]*?\$\{/,
  /(?:exec|execSync)\s*\(\s*['"][^'"]*\$\(/,
  /shell\s*:\s*true/,
];
for (const file of shellScanFiles) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const content = read(file);
  if (suspiciousShellPatterns.some((regex) => regex.test(content))) {
    shellPatternHits += 1;
    fail(`${rel}에 shell 문자열 실행 의심 패턴 발견`);
  }
}
if (shellPatternHits === 0) log.ok('사용자 입력 shell 문자열 실행 의심 패턴 없음');

log.step('메뉴얼 라우터 검사');
exists('docs/MANUAL_INDEX.md') ? log.ok('docs/MANUAL_INDEX.md 존재') : fail('docs/MANUAL_INDEX.md 없음');
exists('scripts/manual-router.mjs') ? log.ok('scripts/manual-router.mjs 존재') : fail('scripts/manual-router.mjs 없음');

log.step('메뉴얼 라우터 shell 안전성 검사');
try {
  const output = execFileSync(process.execPath, ['scripts/manual-router.mjs', '$(echo 게임)'], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  /docs\/GAME_RULES\.md/.test(output) ? fail('shell-like 표현식이 메뉴얼 신호로 해석됨') : log.ok('shell-like 표현식은 메뉴얼 신호로 해석하지 않음');
} catch {
  fail('manual-router shell 안전성 검사 실행 실패');
}

log.step('고위험 변경 감지');
const highRiskRules = [
  { regex: /^app\/api\//, reason: 'API 라우트 변경' },
  { regex: /^middleware\.ts$/, reason: '미들웨어 변경' },
  { regex: /auth|login|signup|session|권한|인증/i, reason: '인증/권한 관련 변경' },
  { regex: /payment|checkout|billing|stripe|toss|결제/i, reason: '결제 관련 변경' },
  { regex: /db|schema|migration|prisma|supabase/i, reason: 'DB/마이그레이션 관련 변경' },
  { regex: /package\.json|package-lock\.json/, reason: '패키지 변경' },
];
if (!headReady) {
  log.ok('첫 커밋 전 초기 세팅 — 고위험 변경 감지 생략');
} else {
  for (const file of changed) {
    for (const rule of highRiskRules) {
      if (rule.regex.test(file)) specialistReasons.add(rule.reason);
    }
  }
  if (specialistReasons.size) {
    warn(`전문 리뷰 권장: ${[...specialistReasons].join(', ')}`);
    log.info('템플릿: docs/agents/QUALITY_REVIEWER.md 또는 TEST_REVIEWER.md');
  } else {
    log.ok('고위험 변경 신호 없음');
  }
}

log.step('위험 명령 추가 검사');
if (gitReady && headReady) {
  let diff = '';
  try {
    diff = git(['diff', '--unified=0', 'HEAD']);
  } catch {
    diff = '';
  }
  const dangerous = /(DROP\s+TABLE|DROP\s+DATABASE|migrate\s+reset|db\s+push\s+--force-reset|rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|\s--force\b)/i;
  const allowed = /(AGENTS\.md|README\.md|docs\/DB_SAFETY\.md|docs\/OPS\.md|scripts\/rollback\.mjs)/;
  const chunks = diff.split(/^diff --git /m).filter(Boolean);
  const unsafe = [];
  for (const chunk of chunks) {
    const header = chunk.split('\n')[0] || '';
    const file = header.split(' b/')[1] || header;
    if (allowed.test(file)) continue;
    const lines = chunk
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++') && dangerous.test(line));
    if (lines.length) unsafe.push(`${file}: ${lines[0].slice(0, 120)}`);
  }
  if (unsafe.length) {
    fail('위험 명령이 새로 추가됨');
    unsafe.slice(0, 5).forEach((line) => log.info(line));
  } else {
    log.ok('위험 명령 추가 없음');
  }
} else {
  log.ok('위험 명령 diff 검사 생략 (git 히스토리 없음)');
}

log.step('마감 전 AI 셀프체크');
[
  '사용자에게 “이렇게 이해했습니다. 맞으면 응이라고 답해주세요.” 확인을 받았는가?',
  'manual-router 결과에 맞는 상세 문서를 읽었는가?',
  '.intent/changed-files.md에 수정 파일을 기록했는가?',
  '5개 초과 파일을 한 번에 건드리지 않았는가?',
  '점수/결제/권한/DB/패키지 변경에 전문 리뷰를 남겼는가?',
  '변경 파일 한국어 3줄 요약과 직접 확인 방법을 준비했는가?',
].forEach((item) => console.log(`  □ ${item}`));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (failed === 0 && warnings === 0) {
  console.log('  ✅ 전부 통과 — 안전');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
} else if (failed === 0) {
  console.log(`  ⚠️  ${warnings}개 경고 — 진행 가능하지만 확인 필요`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
} else {
  console.log(`  ❌ ${failed}개 실패, ${warnings}개 경고`);
  console.log('  → AI에게 “check 실패한 것부터 고쳐줘. 완료 선언 금지.”라고 말하세요.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(1);
}

function confirmationOk() {
  if (!exists('.intent/user-confirmation.md')) return false;
  const confirmation = read(path.join(ROOT, '.intent/user-confirmation.md'));
  return /확인\s*:\s*(예|응|승인|yes)/i.test(confirmation);
}
