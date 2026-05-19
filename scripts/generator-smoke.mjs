#!/usr/bin/env node
// Release smoke test for the pure Alcazar puzzle generator.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = path.join(root, 'lib', 'alcazar-generator.ts');
const source = fs.readFileSync(sourcePath, 'utf-8');
const out = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
  fileName: sourcePath,
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alcazar-generator-'));
const tempModule = path.join(tempDir, 'alcazar-generator.mjs');
fs.writeFileSync(tempModule, out.outputText, 'utf-8');

const {
  BIT,
  countOpenHoles,
  createSeededRng,
  generatePuzzle,
  areAdjacent,
} = await import(pathToFileURL(tempModule).href);

const cases = [
  { w: 4, h: 4, mode: 'two-holes', holes: 2 },
  { w: 4, h: 4, mode: 'more-holes', holes: 2 },
  { w: 4, h: 4, mode: 'one-cycle', holes: 0 },
  { w: 6, h: 6, mode: 'two-holes', holes: 2 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function edgeOpen(mask, cell, dir) {
  return (mask[cell] & BIT[dir]) !== 0;
}

function verifyPuzzle(puzzle, expected) {
  const { graph, solution } = puzzle;
  const n = expected.w * expected.h;

  assert(graph.w === expected.w, `width mismatch: ${graph.w}`);
  assert(graph.h === expected.h, `height mismatch: ${graph.h}`);
  assert(graph.n === n, `graph.n mismatch: ${graph.n}`);
  assert(solution.n === n, `solution.n mismatch: ${solution.n}`);
  assert(solution.path.length === n, `solution length mismatch: ${solution.path.length}`);

  const seen = new Set(solution.path);
  assert(seen.size === n, `solution has duplicate cells: ${seen.size}/${n}`);

  const cycle = expected.mode === 'one-cycle';
  const edgeCount = cycle ? n : n - 1;
  for (let i = 0; i < edgeCount; i += 1) {
    const a = solution.path[i];
    const b = solution.path[(i + 1) % n];
    assert(areAdjacent(a, b, graph.w), `solution cells are not adjacent at ${i}`);
  }

  for (let cell = 0; cell < graph.n; cell += 1) {
    for (let dir = 0; dir < 4; dir += 1) {
      if (edgeOpen(graph.solMask, cell, dir)) {
        assert(edgeOpen(graph.adjMask, cell, dir), `solution edge missing from graph at ${cell}/${dir}`);
      }
    }
  }

  const holes = countOpenHoles(graph);
  if (expected.mode === 'more-holes') {
    assert(holes >= expected.holes, `more-holes has too few holes: ${holes}`);
  } else {
    assert(holes === expected.holes, `${expected.mode} hole count mismatch: ${holes}`);
  }

  assert(!puzzle.deadlineExceeded, `${expected.mode} ${expected.w}x${expected.h} exceeded deadline`);
}

const startedAt = performance.now();
for (let i = 0; i < cases.length; i += 1) {
  const item = cases[i];
  const seed = 7301 + i * 101;
  const puzzle = generatePuzzle(
    item.w,
    item.h,
    item.mode,
    createSeededRng(seed),
    {
      restoreRatio: 0.35,
      solutionDeadlineMs: 120,
      totalDeadlineMs: 5_000,
    },
    seed,
    createSeededRng(seed ^ 0xBEEFCACE)
  );
  verifyPuzzle(puzzle, item);
  console.log(`OK ${item.w}x${item.h} ${item.mode} ${puzzle.timings.totalMs.toFixed(1)}ms`);
}

console.log(`generator smoke OK (${(performance.now() - startedAt).toFixed(1)}ms)`);
