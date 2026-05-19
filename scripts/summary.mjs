#!/usr/bin/env node
// 방금 변경된 파일과 위험 신호를 한국어로 보여준다.
import { execFileSync } from 'node:child_process';

const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';

function hasGit() {
  try {
    execFileSync(gitBin, ['rev-parse', '--git-dir'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function git(args) {
  try {
    return execFileSync(gitBin, args, { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function stripBookkeeping(text) {
  return text
    .split('\n')
    .filter((line) => line && !/\bSTATE\.md\b/.test(line) && !/\b\.intent\//.test(line))
    .join('\n');
}

if (!hasGit()) {
  console.log('\n⚠️  git이 초기화되지 않았어요. 먼저 `git init`을 실행하세요.');
  console.log('   이거 치면 변경 이력을 남길 준비가 됩니다.\n');
  process.exit(1);
}

const stat = stripBookkeeping(git(['diff', 'HEAD', '--stat']));
const nameStatus = stripBookkeeping(git(['diff', 'HEAD', '--name-status']));
const shownStat = stat || stripBookkeeping(git(['diff', '--cached', '--stat']));
const shownNameStatus = nameStatus || stripBookkeeping(git(['diff', '--cached', '--name-status']));

if (!shownStat && !shownNameStatus) {
  console.log('\n변경된 작업 파일이 없어요. STATE.md 같은 자동 기록 파일은 요약에서 제외했습니다.\n');
  process.exit(0);
}

console.log('\n📋 방금 변경된 파일\n');
console.log(shownStat || shownNameStatus);
const changedText = `${shownStat}\n${shownNameStatus}`;
const warnings = [
  [/\.env/, '⚠️  환경설정 파일 변경 — 시크릿 노출 가능성 확인 필요'],
  [/middleware\.ts/, '⚠️  미들웨어 변경 — 보안 영향 큼'],
  [/payment|checkout|결제/i, '⚠️  결제 관련 파일 변경 — 서버 금액 검증 확인'],
  [/auth|login|로그인|권한/i, '⚠️  인증/권한 관련 파일 변경 — 권한 우회 확인'],
  [/migration|schema|prisma|drizzle/i, '⚠️  DB 관련 파일 변경 — 데이터 손실 확인'],
  [/package\.json|package-lock/, '⚠️  의존성 변경 — npm view 확인 기록 필요'],
].filter(([pattern]) => pattern.test(changedText)).map(([, msg]) => msg);
if (warnings.length) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  warnings.forEach((warning) => console.log(warning));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
const files = shownNameStatus
  .split('\n')
  .filter(Boolean)
  .map((line) => line.replace(/^\w\s+/, ''))
  .filter(Boolean);
console.log('\n한국어 3줄 요약 초안');
console.log(`1. 바뀐 파일: ${files.slice(0, 6).join(', ')}${files.length > 6 ? ' 외' : ''}`);
console.log(`2. 위험 신호: ${warnings.length ? `${warnings.length}개 있음. 위 경고 확인 필요.` : '큰 위험 신호 없음.'}`);
console.log('3. AI에게 각 파일이 왜 바뀌었는지와 브라우저 확인 방법을 설명하게 하세요.\n');
