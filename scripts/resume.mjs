#!/usr/bin/env node
// 컨텍스트 압축/세션 끊김 후 AI에게 붙여줄 복원 정보 생성
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function read(file, fallback = '') {
  try {
    return fs.readFileSync(file, 'utf-8').trim();
  } catch {
    return fallback;
  }
}

function manualHint() {
  try {
    return execFileSync(process.execPath, ['scripts/manual-router.mjs'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

const sections = [];
const files = [
  ['최근 진행 — STATE.md 마지막 10줄', 'STATE.md', { tail: true }],
  ['누적 룰 — RULES.md', 'RULES.md', {}],
  ['일반 체크리스트 — CHECKLIST.md', 'CHECKLIST.md', {}],
  ['현재 작업 의도 — .intent/current.md', '.intent/current.md', {}],
  ['현재 계획 — .intent/plan.md', '.intent/plan.md', {}],
  ['작업 맥락 — .intent/context.md', '.intent/context.md', {}],
  ['수정 파일 기록 — .intent/changed-files.md', '.intent/changed-files.md', {}],
];
for (const [title, file, opts] of files) {
  let value = read(file);
  if (opts.tail && value) value = value.split('\n').slice(-10).join('\n');
  if (value) sections.push(`## ${title}\n${value}`);
}
const manuals = read('.intent/manuals.md') || manualHint();
if (manuals) sections.push(`## 메뉴얼 자동 활성화\n${manuals}`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 AI 컨텍스트 복원 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 내용을 통째로 복사해서 AI에게 붙여넣으세요.
AI는 먼저 AGENTS.md를 다시 확인하고, 한국어 한 문장으로 현재 상태와 다음 일을 보고해야 합니다.

────────── 여기부터 복사 ──────────

[프로젝트 상태 복원 — 컨텍스트 압축 가능성 있음. AGENTS.md를 다시 확인하라.]

${sections.join('\n\n')}

---

위 정보를 바탕으로:
1. 지금 어디까지 했고 다음에 무엇을 할 차례인지 한국어 한 문장으로 말해라.
2. 사용자 확인 없이 코드 작성하지 마라.
3. 필요한 메뉴얼만 추가로 읽고 .intent/context.md에 기록해라.
4. 그 다음 사용자의 지시를 기다려라.

────────── 여기까지 복사 ──────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
