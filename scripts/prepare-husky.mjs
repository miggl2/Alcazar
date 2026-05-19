#!/usr/bin/env node
// Prepare Husky hooks when this folder is a git repository.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';
const huskyBin = path.join(process.cwd(), 'node_modules', 'husky', 'bin.js');

function hasGitRepository() {
  try {
    execFileSync(gitBin, ['rev-parse', '--git-dir'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!hasGitRepository()) {
  console.log('git 저장소가 아니어서 Husky hook 준비를 건너뜁니다. zip 사용자는 `git init` 후 `npm run prepare`를 실행하세요.');
  process.exit(0);
}

try {
  if (!fs.existsSync(huskyBin)) {
    throw new Error('node_modules/husky/bin.js 없음');
  }
  execFileSync(process.execPath, [huskyBin], { stdio: 'inherit' });
} catch (error) {
  console.error('Husky hook 준비 실패. git 상태와 node_modules 설치 상태를 확인하세요.');
  if (error instanceof Error && error.message) console.error(error.message);
  process.exit(typeof error.status === 'number' ? error.status : 1);
}
