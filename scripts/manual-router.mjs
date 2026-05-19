#!/usr/bin/env node
// 요청/작업 파일을 보고 필요한 메뉴얼만 고른다. 사용자용 명령어가 아니라 AI 작업 보조 도구.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function stripShellLikeExpressions(text) {
  return text.replace(/\$\([^)]*\)|`[^`]*`/g, ' ');
}

function git(args) {
  return execFileSync(gitBin, args, { stdio: 'pipe', encoding: 'utf-8' });
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

function gitFiles() {
  if (!hasGit() || !hasHead()) return '';
  try {
    const status = git(['status', '--porcelain']);
    return status
      .split('\n')
      .map((line) => line.slice(3))
      .join('\n');
  } catch {
    return '';
  }
}

const planSignal = safeRead('.intent/plan.md')
  .split('\n')
  .filter((line) => !/아니오|없음|해당 없음/.test(line))
  .join('\n');
const rawArgSignal = process.argv.slice(2).join(' ');
const hasShellLikeArg = /\$\([^)]*\)|`[^`]*`/.test(rawArgSignal);
const source = stripShellLikeExpressions([
  rawArgSignal,
  hasShellLikeArg ? '' : safeRead('.intent/current.md'),
  hasShellLikeArg ? '' : planSignal,
  hasShellLikeArg ? '' : gitFiles(),
].join('\n')).toLowerCase();

const rules = [
  { doc: 'docs/GAME_RULES.md', reason: '게임/점수/세이브/캔버스/BGM/모바일 조작 신호', regex: /게임|점수|랭킹|리더보드|세이브|저장|canvas|캔버스|bgm|audio|오디오|루프|캐릭터|스테이지|레벨|game|score|save|leaderboard/ },
  { doc: 'docs/KOREAN.md', reason: '한글 입력/한국어 UI/카카오/모바일 문구 신호', regex: /한글|한국어|입력|검색|채팅|카카오|모바일|문구|복사|공유|ime|korean|copy|placeholder|textarea|input/ },
  { doc: 'docs/SECURITY.md', reason: 'API/인증/권한/결제/시크릿/봇 방어 신호', regex: /api|인증|로그인|회원가입|권한|결제|토스|stripe|시크릿|비밀번호|토큰|봇|어뷰즈|rate.?limit|security|auth|payment|secret|password|token|middleware/ },
  { doc: 'docs/DB_SAFETY.md', reason: 'DB/schema/migration/SQL/Supabase/Prisma 신호', regex: /db|database|데이터베이스|schema|스키마|migration|마이그레이션|sql|supabase|prisma|drizzle|postgres|테이블|컬럼/ },
  { doc: 'docs/OPS.md', reason: '배포/도메인/Sentry/환경변수/모니터링 신호', regex: /배포|vercel|도메인|sentry|환경변수|\.env|모니터링|알림|deploy|domain|ops|uptime|production|build/ },
];
const matched = rules.filter((rule) => rule.regex.test(source));
const lines = matched.length
  ? matched.map((rule) => `- ${rule.doc} — ${rule.reason}`)
  : ['- 추가 메뉴얼 없음 — AGENTS.md, RULES.md, CHECKLIST.md만으로 진행'];
const output = [
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '📚 메뉴얼 자동 활성화 결과',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ...lines,
  '',
  'AI는 위 문서만 추가로 읽고, 읽은 사실을 .intent/context.md에 기록하세요.',
].join('\n');
console.log(output);
if (fs.existsSync('.intent')) fs.writeFileSync(path.join('.intent', 'manuals.md'), `${output}\n`, 'utf-8');
