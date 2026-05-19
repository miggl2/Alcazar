#!/usr/bin/env node
// 새 작업 시작용 기록 파일 생성. 사용자가 양식을 채우는 도구가 아니라 AI가 계획·맥락을 남기는 장치.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = path.join(process.cwd(), '.intent');
const archiveDir = path.join(dir, 'archive');
const rawRequest = process.argv.slice(2).join(' ').trim();
const now = new Date().toISOString();
function safeRename(from, to) { if (fs.existsSync(from)) fs.renameSync(from, to); }
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(path.join(dir, 'current.md'))) {
  const stamp = now.replace(/[:.]/g, '-').slice(0, 19);
  const target = path.join(archiveDir, stamp);
  fs.mkdirSync(target, { recursive: true });
  for (const file of ['current.md', 'plan.md', 'context.md', 'checklist.md', 'changed-files.md', 'user-confirmation.md', 'manuals.md', 'package-checks.md']) safeRename(path.join(dir, file), path.join(target, file));
  console.log(`\n📁 이전 작업 기록을 .intent/archive/${stamp}/ 로 옮겼어요.`);
}
const requestText = rawRequest || '[AI가 사용자의 최신 요청을 여기에 한국어로 요약한다]';
fs.writeFileSync(path.join(dir, 'current.md'), `# 현재 작업 의도\n\n## 원 요청\n${requestText}\n\n## AI가 이해한 것\n- 원하는 것:\n- 원하지 않을 것 같은 것:\n- 영향받는 기능/파일:\n\n## poor prompt 분류\n\n### 답변됨\n- \n\n### 추정됨\n- 추정:\n- 확인 질문:\n\n### 미답변\n- 질문:\n- 왜 필요한지:\n\n## 사용자 확인 전 상태\n확인 전에는 코드 작성 금지.\n`, 'utf-8');
fs.writeFileSync(path.join(dir, 'plan.md'), `# 작업 계획\n\n## 목표\n- \n\n## 예상 수정 파일\n- \n\n## 수정하지 않을 것\n- \n\n## 위험 요소\n- 5개 초과 파일: 아니오\n- 패키지 추가: 아니오\n- 결제/권한/DB/점수: 아니오\n- 위험 명령 필요: 아니오\n\n## 실행 순서\n1. 사용자 의도 확인\n2. 필요한 메뉴얼만 읽기\n3. 작은 단위로 수정\n4. 수정 파일 기록\n5. npm run check\n6. 3줄 요약과 직접 확인 방법 안내\n`, 'utf-8');
fs.writeFileSync(path.join(dir, 'context.md'), `# 작업 맥락 노트\n\n## 생성 시각\n${now}\n\n## 읽은 기본 문서\n- AGENTS.md\n- RULES.md\n- CHECKLIST.md\n- docs/MANUAL_INDEX.md\n\n## 자동 활성화된 추가 메뉴얼\n- scripts/manual-router.mjs 결과를 참고해 AI가 채운다.\n\n## 작업 중 결정과 근거\n- \n`, 'utf-8');
fs.writeFileSync(path.join(dir, 'package-checks.md'), `# 패키지 검증 기록\n\n새 패키지 추가 또는 버전 변경 시 AI가 아래 형식으로 기록한다.\n\n- npm view <패키지명> version — 확인 결과: \n- 설치/변경 이유: \n- major 업그레이드 여부: 아니오\n`, 'utf-8');
fs.writeFileSync(path.join(dir, 'checklist.md'), `# 이번 작업 체크리스트\n\n- [ ] 사용자 의도 확인 받음\n- [ ] 필요한 메뉴얼만 읽음\n- [ ] 예상 수정 파일 5개 이하\n- [ ] 실제 수정 파일을 changed-files.md에 기록\n- [ ] 시키지 않은 리팩토링 없음\n- [ ] 점수/결제/권한/DB는 서버 검증 확인\n- [ ] 새 패키지 있으면 npm view 기록\n- [ ] npm run check 실행\n- [ ] 변경 파일 3줄 요약 준비\n- [ ] 사용자가 직접 확인할 방법 준비\n`, 'utf-8');
fs.writeFileSync(path.join(dir, 'changed-files.md'), `# 수정 파일 기록\n\n파일을 수정할 때마다 AI가 아래 형식으로 누적한다.\n\n- [파일 경로] — [왜 수정했는지]\n`, 'utf-8');
fs.writeFileSync(path.join(dir, 'user-confirmation.md'), `# 사용자 확인 기록\n\n확인: 아니오\n\n## 확인받은 문장\n- \n\n## 사용자의 답변\n- \n\n코드 작성 전 이 파일의 첫 줄을 \`확인: 예\`로 바꾸고, 어떤 확인을 받았는지 적는다.\n`, 'utf-8');
try {
  const args = [path.join(process.cwd(), 'scripts', 'manual-router.mjs'), rawRequest];
  const manualOutput = execFileSync(process.execPath, args, { stdio: 'pipe', encoding: 'utf-8' });
  const manualLines = manualOutput
    .split('\n')
    .filter((line) => line.startsWith('- docs/') || line.startsWith('- 추가 메뉴얼'))
    .join('\n');
  if (manualLines) {
    const contextPath = path.join(dir, 'context.md');
    const context = fs.readFileSync(contextPath, 'utf-8').replace(
      '- scripts/manual-router.mjs 결과를 참고해 AI가 채운다.',
      manualLines
    );
    fs.writeFileSync(contextPath, context, 'utf-8');
  }
  console.log(`\n${manualOutput}`);
} catch {}
console.log('\n📝 새 작업 기록 파일을 만들었습니다.');
console.log('   위치: .intent/');
console.log('\n사용자가 직접 양식을 채울 필요는 없습니다. AI가 아래 순서로 진행해야 합니다.');
console.log('1. 사용자 요청을 항목화한다.');
console.log('2. 답변됨/추정됨/미답변으로 나눈다.');
console.log('3. “이렇게 이해했습니다. 맞으면 응이라고 답해주세요.”라고 확인한다.');
console.log('4. 확인을 받은 뒤 .intent/user-confirmation.md를 갱신한다.');
console.log('5. 필요한 메뉴얼과 계획을 확정한 뒤 코드 작성한다.');
