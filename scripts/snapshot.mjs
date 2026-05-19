#!/usr/bin/env node
// 큰 작업 전 안전 백업 — rollback이 작동하려면 미리 찍어둬야 함
import { execFileSync } from 'node:child_process';

const git = (args, options = {}) => execFileSync('git', args, { stdio: 'pipe', encoding: 'utf-8', ...options });

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
  console.log('   먼저 한 번만: git init && git add -A && git commit -m "first"\n');
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const tag = `snapshot-${ts}`;

try {
  // 변경된 게 있으면 다 포함
  git(['add', '-A']);
  // empty도 허용해서 변경이 없어도 시점 찍기
  git(['commit', '-m', `snapshot ${ts}`, '--allow-empty']);
  git(['tag', tag]);
  console.log(`\n✅ 스냅샷 생성: ${tag}`);
  console.log('   되돌릴 때: npm run rollback\n');
} catch (e) {
  console.log('\n❌ 스냅샷 실패:', e.message);
  console.log('   git user.email 설정이 필요할 수 있어요:');
  console.log('   git config user.email "your@email.com"');
  console.log('   git config user.name "Your Name"\n');
}
