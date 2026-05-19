#!/usr/bin/env node
// 30분 전으로 되돌리기 — git 모르는 비코더용 안전망
import { execFileSync } from 'node:child_process';
import readline from 'node:readline';

const git = (args, options = {}) => execFileSync('git', args, { stdio: 'pipe', encoding: 'utf-8', ...options });
const safeGitRef = (ref) => /^[A-Za-z0-9._/-]+$/.test(ref);

const hasGit = () => {
  try {
    git(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
};

if (!hasGit()) {
  console.log('\n⚠️  git이 초기화되지 않았어요.');
  console.log('   먼저 터미널에서: git init');
  console.log('   그리고 첫 작업 전: npm run snapshot');
  console.log('   를 한 번 실행하세요.\n');
  process.exit(1);
}

// 스냅샷 태그 + 최근 commit 모으기
let snapshots = [];
try {
  snapshots = git(['tag', '-l', 'snapshot-*', '--sort=-creatordate']).trim().split('\n').filter(Boolean);
} catch {}

let recentCommits = [];
try {
  recentCommits = git(['log', '--oneline', '-15', '--format=%h|%ar|%s']).trim().split('\n').filter(Boolean);
} catch {}

if (snapshots.length === 0 && recentCommits.length === 0) {
  console.log('\n되돌릴 지점이 없어요. 첫 작업 전 `npm run snapshot`을 먼저 실행하세요.\n');
  process.exit(1);
}

console.log('\n📦 되돌릴 수 있는 지점:\n');

const points = [];
if (snapshots.length > 0) {
  console.log('  = 스냅샷 (가장 안전한 복원 지점) =');
  snapshots.slice(0, 5).forEach((s) => {
    if (!safeGitRef(s)) return;
    const idx = points.length + 1;
    points.push({ ref: s, label: s });
    const time = s.replace('snapshot-', '').replace(/-/g, ':').slice(0, 16);
    console.log(`  ${idx}. ${time} (스냅샷)`);
  });
}
if (recentCommits.length > 0) {
  console.log('\n  = 최근 작업 기록 =');
  recentCommits.forEach((c) => {
    const [hash, when, msg] = c.split('|');
    if (!safeGitRef(hash)) return;
    const idx = points.length + 1;
    points.push({ ref: hash, label: msg });
    console.log(`  ${idx}. ${when} — ${msg}`);
  });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(
  '\n어느 지점으로 되돌릴까요? (번호 입력, 취소는 그냥 Enter): ',
  (answer) => {
    rl.close();
    const num = Number.parseInt(answer, 10);
    if (!num || num < 1 || num > points.length) {
      console.log('취소됨.\n');
      return;
    }
    const target = points[num - 1];
    if (!safeGitRef(target.ref)) {
      console.log('\n❌ 안전하지 않은 git 참조라서 중단합니다.\n');
      return;
    }

    // 안전 그물: 현재 상태도 자동 백업
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupTag = `before-rollback-${ts}`;
    try {
      git(['add', '-A']);
      git(['commit', '-m', `auto-backup before rollback ${ts}`, '--allow-empty']);
      git(['tag', backupTag]);
    } catch {}

    try {
      git(['reset', '--hard', target.ref]);
      console.log(`\n✅ 되돌려졌어요: ${target.label}`);
      console.log('   취소하고 싶으면 한 줄:');
      console.log(`     git reset --hard ${backupTag}\n`);
    } catch (e) {
      console.log('\n❌ 롤백 실패:', e.message);
      console.log(`   원래 상태로: git reset --hard ${backupTag}\n`);
    }
  }
);
