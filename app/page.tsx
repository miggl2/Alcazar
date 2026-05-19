'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChessBishop,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Check,
  Clock,
  Copy,
  DoorClosed,
  Eraser,
  Home,
  LoaderCircle,
  Lock,
  LockOpen,
  Palette,
  Play,
  RotateCcw,
  Settings,
  Sprout,
  Undo2,
  Vibrate,
  VibrateOff,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  BIT,
  Dir,
  type Cell,
  type GeneratedPuzzle,
  type HoleMode,
  boundaryDirs,
  directionBetween,
  neighborInDir,
  xOf,
  yOf,
} from '@/lib/alcazar-generator';
import { z } from 'zod';
import { createSaveStore } from '@/lib/save-game';
import { makePuzzle, type MakePuzzleInput } from '@/lib/alcazar-puzzle-factory';

type SavedRun = {
  width: number;
  height: number;
  mode: HoleMode;
  difficulty: number;
  seedText: string;
  customSeed: boolean;
  startedAtMs: number;
  internalEdges: string[];
  exitEdges: string[];
  lockedInternalEdges: string[];
  lockedExitEdges: string[];
};

type SaveData = {
  bestTimes: Record<string, number>;
  puzzlesSolved: number;
  currentRun: SavedRun | null;
  styleId: StyleId;
  vibration: boolean;
};

type InkPoint = {
  x: number;
  y: number;
};

type PointerSample = {
  clientX: number;
  clientY: number;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

type DragSegment =
  | { kind: 'internal'; from: Cell; to: Cell; key: string }
  | { kind: 'exit'; cell: Cell; dir: Dir; key: string };

type DragState = {
  anchor: Cell;
  pointerId: number;
  inkPoints: InkPoint[];
  segments: DragSegment[];
};

type Scene = 'menu' | 'setup' | 'style' | 'settings';
type StyleId = 'warm' | 'clean' | 'dark';

type DrawStats = {
  degrees: number[];
  internalConnectedCells: number;
  touchedCells: Set<number>;
  solved: boolean;
};

type DrawSnapshot = {
  internalEdges: string[];
  exitEdges: string[];
};

const DEFAULT_WIDTH = 6;
const DEFAULT_HEIGHT = 6;
const DEFAULT_DIFFICULTY = 70;
const DEFAULT_K = 1 - DEFAULT_DIFFICULTY / 100;
const DEFAULT_SEED_TEXT = 'seed';
const SVG_PAD = 0.12;
const APP_SHELL_STYLE = {
  width: '390px',
  height: '693.333px',
  flexShrink: 0,
  '--app-unit': '3.9px',
  '--ui-btn': 'calc(var(--app-unit) * 10.5)',
  '--ui-icon-sm': 'calc(var(--app-unit) * 4.4)',
  '--ui-icon-md': 'calc(var(--app-unit) * 5.6)',
  '--ui-icon-lg': 'calc(var(--app-unit) * 7.1)',
  '--ui-gap': 'calc(var(--app-unit) * 1.35)',
  '--ui-pad': 'calc(var(--app-unit) * 2.25)',
} as const;
const DIFFICULTY_PRESETS = [60, 70, 80, 90, 100] as const;
const GENERATION_START_DELAY_MS = 160;
const SIZE_PRESETS = [
  { id: '4x4', label: '4 x 4', width: 4, height: 4, iconCells: 2 },
  { id: '6x6', label: '6 x 6', width: 6, height: 6, iconCells: 3 },
  { id: '10x10', label: '10 x 10', width: 10, height: 10, iconCells: 4 },
  { id: '14x14', label: '14 x 14', width: 14, height: 14, iconCells: 5 },
  { id: '18x18', label: '18 x 18', width: 18, height: 18, iconCells: 6 },
] as const;

type SizePresetId = (typeof SIZE_PRESETS)[number]['id'];

const STYLE_PRESETS = [
  {
    id: 'warm',
    colors: {
      page: '#caa979',
      shell: '#ead8bd',
      tileA: '#e7c894',
      tileB: '#d9b47b',
      panel: '#d9b47b',
      control: '#e7c894',
      primary: '#6f4424',
      primaryHover: '#5a351b',
      text: '#2f2118',
      mutedText: '#5d3a20',
      wall: '#3f2818',
      board: '#d8b889',
      path: '#24323d',
      lockedPath: '#111a20',
      loop: '#9a3f24',
      completedA: '#b48651',
      completedB: '#a57443',
      dialog: '#fff8ec',
      border: '#8b6138',
    },
  },
  {
    id: 'clean',
    colors: {
      page: '#d8e0df',
      shell: '#f3f1ea',
      tileA: '#f5efe2',
      tileB: '#d8e3df',
      panel: '#d8e3df',
      control: '#f5efe2',
      primary: '#2f5d63',
      primaryHover: '#24494e',
      text: '#1f2c2f',
      mutedText: '#38575b',
      wall: '#243133',
      board: '#e7e1d4',
      path: '#17252a',
      lockedPath: '#0b1114',
      loop: '#b4473e',
      completedA: '#b8c8c2',
      completedB: '#a9b9b2',
      dialog: '#fbf8ef',
      border: '#78908d',
    },
  },
  {
    id: 'dark',
    colors: {
      page: '#16191a',
      shell: '#242220',
      tileA: '#3a332c',
      tileB: '#2f3b3d',
      panel: '#2b302f',
      control: '#3a332c',
      primary: '#b98d5d',
      primaryHover: '#d0a875',
      text: '#f2e6d2',
      mutedText: '#d2b68e',
      wall: '#15110e',
      board: '#302b27',
      path: '#9db2bd',
      lockedPath: '#e7d5b8',
      loop: '#d76a5c',
      completedA: '#4f493e',
      completedB: '#444036',
      dialog: '#2b2926',
      border: '#8d765a',
    },
  },
] as const;

const savedRunSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  mode: z.enum(['two-holes', 'more-holes', 'one-cycle']),
  difficulty: z.number().int().min(0).max(100),
  seedText: z.string().min(1),
  customSeed: z.boolean(),
  startedAtMs: z.number().int().nonnegative(),
  internalEdges: z.array(z.string()),
  exitEdges: z.array(z.string()),
  lockedInternalEdges: z.array(z.string()),
  lockedExitEdges: z.array(z.string()),
});

const saveSchema = z.object({
  bestTimes: z.record(z.number().int().nonnegative()),
  puzzlesSolved: z.number().int().nonnegative(),
  currentRun: savedRunSchema.nullable(),
  styleId: z.enum(['warm', 'clean', 'dark']),
  vibration: z.boolean(),
});

function migrateLegacySaveData(oldData: unknown): SaveData {
  if (typeof oldData !== 'object' || oldData === null) {
    return { bestTimes: {}, puzzlesSolved: 0, currentRun: null, styleId: 'warm', vibration: true };
  }

  const maybePuzzlesSolved = (oldData as { puzzlesSolved?: unknown }).puzzlesSolved;
  const puzzlesSolved =
    typeof maybePuzzlesSolved === 'number' && Number.isFinite(maybePuzzlesSolved)
      ? Math.max(0, Math.floor(maybePuzzlesSolved))
      : 0;
  const maybeBestTimes = (oldData as { bestTimes?: unknown }).bestTimes;
  const bestTimes: Record<string, number> = {};

  if (typeof maybeBestTimes === 'object' && maybeBestTimes !== null) {
    for (const [key, value] of Object.entries(maybeBestTimes)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        bestTimes[key] = Math.floor(value);
      }
    }
  }

  const maybeStyleId = (oldData as { styleId?: unknown }).styleId;
  const styleId =
    maybeStyleId === 'clean' || maybeStyleId === 'dark' || maybeStyleId === 'warm' ? maybeStyleId : 'warm';
  const maybeVibration = (oldData as { vibration?: unknown }).vibration;

  return {
    bestTimes,
    puzzlesSolved,
    currentRun: null,
    styleId,
    vibration: typeof maybeVibration === 'boolean' ? maybeVibration : true,
  };
}

const saveStore = createSaveStore<SaveData>({
  key: 'alcazar-save',
  currentVersion: 4,
  schemas: { 4: saveSchema },
  defaultData: { bestTimes: {}, puzzlesSolved: 0, currentRun: null, styleId: 'warm', vibration: true },
  migrate: {
    2: migrateLegacySaveData,
    3: migrateLegacySaveData,
    4: migrateLegacySaveData,
  },
});

function edgeKey(a: Cell, b: Cell) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function parseEdgeKey(key: string): [Cell, Cell] {
  const [a, b] = key.split('-').map(Number);
  return [a, b];
}

function exitKey(cell: Cell, dir: Dir) {
  return `${cell}:${dir}`;
}

function parseExitKey(key: string): { cell: Cell; dir: Dir } {
  const [cell, dir] = key.split(':');
  return { cell: Number(cell), dir: Number(dir) as Dir };
}

function formatTime(ms: number | null) {
  if (ms === null) return '-';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatRecordTime(ms: number | null) {
  if (ms === null) return '-';
  const totalCentiseconds = Math.floor(ms / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function bestTimeKey(width: number, height: number, difficulty: number, mode: HoleMode) {
  return `${width}x${height}:${difficulty}:${mode}`;
}

function findSizePresetId(width: number, height: number): SizePresetId {
  return SIZE_PRESETS.find((preset) => preset.width === width && preset.height === height)?.id ?? '6x6';
}

function isOpenMove(puzzle: GeneratedPuzzle, from: Cell, to: Cell) {
  const dir = directionBetween(from, to, puzzle.graph.w);
  return (puzzle.graph.adjMask[from] & BIT[dir]) !== 0;
}

function hasOpenHole(puzzle: GeneratedPuzzle, cell: Cell, dir: Dir) {
  return (puzzle.graph.holeMask[cell] & BIT[dir]) !== 0;
}

function lineForInternalEdge(w: number, key: string) {
  const [a, b] = parseEdgeKey(key);
  return {
    x1: xOf(a, w) + 0.5,
    y1: yOf(a, w) + 0.5,
    x2: xOf(b, w) + 0.5,
    y2: yOf(b, w) + 0.5,
  };
}

function lineForExit(w: number, key: string) {
  const { cell, dir } = parseExitKey(key);
  const x = xOf(cell, w);
  const y = yOf(cell, w);
  const center = { x: x + 0.5, y: y + 0.5 };
  if (dir === Dir.R) return { x1: center.x, y1: center.y, x2: x + 1, y2: center.y };
  if (dir === Dir.D) return { x1: center.x, y1: center.y, x2: center.x, y2: y + 1 };
  if (dir === Dir.L) return { x1: center.x, y1: center.y, x2: x, y2: center.y };
  return { x1: center.x, y1: center.y, x2: center.x, y2: y };
}

function wallLineForInternal(w: number, key: string) {
  const [a, b] = parseEdgeKey(key);
  const ax = xOf(a, w);
  const ay = yOf(a, w);
  const bx = xOf(b, w);
  const by = yOf(b, w);

  if (ax !== bx) {
    const x = Math.max(ax, bx);
    return { x1: x, y1: ay, x2: x, y2: ay + 1 };
  }

  const y = Math.max(ay, by);
  return { x1: ax, y1: y, x2: ax + 1, y2: y };
}

function wallLineForBoundary(w: number, cell: Cell, dir: Dir) {
  const x = xOf(cell, w);
  const y = yOf(cell, w);
  if (dir === Dir.R) return { x1: x + 1, y1: y, x2: x + 1, y2: y + 1 };
  if (dir === Dir.D) return { x1: x, y1: y + 1, x2: x + 1, y2: y + 1 };
  if (dir === Dir.L) return { x1: x, y1: y, x2: x, y2: y + 1 };
  return { x1: x, y1: y, x2: x + 1, y2: y };
}

function analyzeDraw(
  puzzle: GeneratedPuzzle | null,
  internalEdges: Set<string>,
  exitEdges: Set<string>
): DrawStats {
  const n = puzzle?.graph.n ?? 0;
  const degrees = new Array<number>(n).fill(0);
  const touchedCells = new Set<number>();
  const graph = Array.from({ length: n }, () => [] as number[]);

  for (const key of internalEdges) {
    const [a, b] = parseEdgeKey(key);
    degrees[a] += 1;
    degrees[b] += 1;
    touchedCells.add(a);
    touchedCells.add(b);
    graph[a].push(b);
    graph[b].push(a);
  }

  for (const key of exitEdges) {
    const { cell } = parseExitKey(key);
    degrees[cell] += 1;
    touchedCells.add(cell);
  }

  let internalConnectedCells = 0;
  if (internalEdges.size > 0) {
    const firstKey = internalEdges.values().next().value;
    const first = firstKey ? parseEdgeKey(firstKey)[0] : 0;
    const seen = new Set<number>();
    const stack = [first];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of graph[current]) stack.push(next);
    }
    internalConnectedCells = seen.size;
  } else if (n === 1 && touchedCells.has(0)) {
    internalConnectedCells = 1;
  }

  let solved = false;
  if (puzzle !== null) {
    solved = puzzle.mode === 'one-cycle'
      ? internalEdges.size === n &&
        exitEdges.size === 0 &&
        internalConnectedCells === n &&
        degrees.every((degree) => degree === 2)
      : internalEdges.size === n - 1 &&
        exitEdges.size === 2 &&
        internalConnectedCells === n &&
        degrees.every((degree) => degree === 2);
  }

  return { degrees, internalConnectedCells, touchedCells, solved };
}

function findInternalLoopEdges(total: number, edges: Set<string>) {
  const graph = Array.from({ length: total }, () => [] as Array<{ cell: number; key: string }>);

  const findPathEdges = (start: number, end: number) => {
    const seen = new Uint8Array(total);
    const parentCell = new Int32Array(total).fill(-1);
    const parentEdge = new Array<string>(total).fill('');
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === end) break;

      for (const next of graph[current]) {
        if (seen[next.cell]) continue;
        seen[next.cell] = 1;
        parentCell[next.cell] = current;
        parentEdge[next.cell] = next.key;
        stack.push(next.cell);
      }
    }

    if (!seen[end]) return null;

    const path = new Set<string>();
    let current = end;
    while (current !== start) {
      const key = parentEdge[current];
      if (!key) return null;
      path.add(key);
      current = parentCell[current];
    }
    return path;
  };

  for (const key of edges) {
    const [a, b] = parseEdgeKey(key);
    const loopPath = findPathEdges(a, b);
    if (loopPath) {
      loopPath.add(key);
      return loopPath;
    }

    graph[a].push({ cell: b, key });
    graph[b].push({ cell: a, key });
  }

  return new Set<string>();
}


function pointerToCell(
  event: React.PointerEvent<HTMLElement>,
  puzzle: GeneratedPuzzle
): Cell | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  if (px < 0 || py < 0 || px > 1 || py > 1) return null;
  const x = Math.min(puzzle.graph.w - 1, Math.floor(px * puzzle.graph.w));
  const y = Math.min(puzzle.graph.h - 1, Math.floor(py * puzzle.graph.h));
  return y * puzzle.graph.w + x;
}

function readPointerSample(event: React.PointerEvent<HTMLElement>): PointerSample {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}

function readNativePointerSample(event: PointerEvent, rect: DOMRect): PointerSample {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}

function samplePosition(sample: PointerSample) {
  return {
    px: (sample.clientX - sample.rect.left) / sample.rect.width,
    py: (sample.clientY - sample.rect.top) / sample.rect.height,
  };
}

function pointerToBoardPoint(event: React.PointerEvent<HTMLElement>, puzzle: GeneratedPuzzle): InkPoint {
  return sampleToBoardPoint(readPointerSample(event), puzzle);
}

function sampleToBoardPoint(sample: PointerSample, puzzle: GeneratedPuzzle): InkPoint {
  const { px, py } = samplePosition(sample);
  return {
    x: Math.max(-SVG_PAD, Math.min(puzzle.graph.w + SVG_PAD, px * puzzle.graph.w)),
    y: Math.max(-SVG_PAD, Math.min(puzzle.graph.h + SVG_PAD, py * puzzle.graph.h)),
  };
}

function sampleToCell(sample: PointerSample, puzzle: GeneratedPuzzle): Cell | null {
  const { px, py } = samplePosition(sample);
  if (px < 0 || py < 0 || px > 1 || py > 1) return null;
  const x = Math.min(puzzle.graph.w - 1, Math.floor(px * puzzle.graph.w));
  const y = Math.min(puzzle.graph.h - 1, Math.floor(py * puzzle.graph.h));
  return y * puzzle.graph.w + x;
}

function pointerExitDir(
  event: React.PointerEvent<HTMLElement>,
  puzzle: GeneratedPuzzle,
  anchor: Cell
): Dir | null {
  return sampleExitDir(readPointerSample(event), puzzle, anchor);
}

function sampleExitDir(sample: PointerSample, puzzle: GeneratedPuzzle, anchor: Cell): Dir | null {
  const { px, py } = samplePosition(sample);
  const gridX = px * puzzle.graph.w;
  const gridY = py * puzzle.graph.h;
  const x = xOf(anchor, puzzle.graph.w);
  const y = yOf(anchor, puzzle.graph.w);

  if (x === 0 && (px < 0 || gridX < 0.12)) return Dir.L;
  if (x === puzzle.graph.w - 1 && (px > 1 || gridX > puzzle.graph.w - 0.12)) return Dir.R;
  if (y === 0 && (py < 0 || gridY < 0.12)) return Dir.U;
  if (y === puzzle.graph.h - 1 && (py > 1 || gridY > puzzle.graph.h - 0.12)) return Dir.D;
  return null;
}

function appendInkPoint(points: InkPoint[], point: InkPoint) {
  const last = points[points.length - 1];
  if (last) {
    const dx = last.x - point.x;
    const dy = last.y - point.y;
    if (dx * dx + dy * dy < 0.0025) return points;
  }
  return [...points, point];
}

function segmentAlreadyLast(segments: DragSegment[], key: string) {
  return segments[segments.length - 1]?.key === key;
}

function extendDragState(
  sample: PointerSample,
  puzzle: GeneratedPuzzle,
  state: DragState
): DragState {
  let nextState = {
    ...state,
    inkPoints: appendInkPoint(state.inkPoints, sampleToBoardPoint(sample, puzzle)),
  };

  const exitDir = sampleExitDir(sample, puzzle, state.anchor);
  if (exitDir !== null && hasOpenHole(puzzle, state.anchor, exitDir)) {
    const key = exitKey(state.anchor, exitDir);
    if (!segmentAlreadyLast(nextState.segments, key)) {
      nextState = {
        ...nextState,
        segments: [...nextState.segments, { kind: 'exit', cell: state.anchor, dir: exitDir, key }],
      };
    }
    return nextState;
  }

  const cell = sampleToCell(sample, puzzle);
  if (cell === null || cell === state.anchor) return nextState;

  const adjacent =
    Math.abs(xOf(cell, puzzle.graph.w) - xOf(state.anchor, puzzle.graph.w)) +
      Math.abs(yOf(cell, puzzle.graph.w) - yOf(state.anchor, puzzle.graph.w)) ===
    1;
  if (!adjacent || !isOpenMove(puzzle, state.anchor, cell)) {
    return { ...nextState, anchor: cell };
  }

  const key = edgeKey(state.anchor, cell);
  if (segmentAlreadyLast(nextState.segments, key)) {
    return { ...nextState, anchor: cell };
  }
  return {
    ...nextState,
    anchor: cell,
    segments: [...nextState.segments, { kind: 'internal', from: state.anchor, to: cell, key }],
  };
}

function LockIcon({ unlocked = false }: { unlocked?: boolean }) {
  return unlocked ? (
    <LockOpen aria-hidden="true" className="h-[var(--ui-icon-sm)] w-[var(--ui-icon-sm)]" />
  ) : (
    <Lock aria-hidden="true" className="h-[var(--ui-icon-sm)] w-[var(--ui-icon-sm)]" />
  );
}

function EraserIcon() {
  return <Eraser aria-hidden="true" className="h-[var(--ui-icon-sm)] w-[var(--ui-icon-sm)]" />;
}

function SizePresetIcon({ cells }: { cells: number }) {
  const gap = 1.1;
  const size = (20 - gap * (cells - 1)) / cells;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[var(--ui-icon-lg)] w-[var(--ui-icon-lg)]">
      {Array.from({ length: cells * cells }, (_, index) => {
        const x = index % cells;
        const y = Math.floor(index / cells);
        return (
          <rect
            key={index}
            x={2 + x * (size + gap)}
            y={2 + y * (size + gap)}
            width={size}
            height={size}
            rx="0.35"
            fill="currentColor"
            opacity={(x + y) % 2 === 0 ? 0.95 : 0.58}
          />
        );
      })}
    </svg>
  );
}

function DifficultyIcon({ value }: { value: (typeof DIFFICULTY_PRESETS)[number] }) {
  const className = 'h-[var(--ui-icon-lg)] w-[var(--ui-icon-lg)]';
  if (value === 60) return <ChessPawn aria-hidden="true" className={className} />;
  if (value === 70) return <ChessKnight aria-hidden="true" className={className} />;
  if (value === 80) return <ChessBishop aria-hidden="true" className={className} />;
  if (value === 90) return <ChessRook aria-hidden="true" className={className} />;
  return <ChessQueen aria-hidden="true" className={className} />;
}

function EntranceIcon({ mode }: { mode: HoleMode }) {
  if (mode === 'two-holes') {
    return (
      <span aria-hidden="true" className="relative flex h-[var(--ui-icon-lg)] w-[calc(var(--ui-icon-lg)*1.5)] items-center justify-center">
        <DoorClosed className="h-[var(--ui-icon-lg)] w-[var(--ui-icon-lg)]" />
      </span>
    );
  }

  if (mode === 'more-holes') {
    return (
      <span aria-hidden="true" className="flex h-[var(--ui-icon-lg)] w-full items-center justify-center gap-[var(--ui-gap)] text-[var(--muted-text)]">
        <DoorClosed className="h-[var(--ui-icon-md)] w-[var(--ui-icon-md)]" />
        <DoorClosed className="h-[var(--ui-icon-md)] w-[var(--ui-icon-md)]" />
        <DoorClosed className="h-[var(--ui-icon-md)] w-[var(--ui-icon-md)]" />
      </span>
    );
  }

  return <span aria-hidden="true" className="block h-[var(--ui-icon-lg)] w-[calc(var(--ui-icon-lg)*1.5)]" />;
}

function ContinueIcon() {
  return <RotateCcw aria-hidden="true" className="h-[42%] w-[42%]" strokeWidth={2.5} />;
}

function CreateIcon() {
  return <Play aria-hidden="true" className="h-[42%] w-[42%]" fill="currentColor" strokeWidth={2.2} />;
}

function StyleIcon() {
  return <Palette aria-hidden="true" className="h-[42%] w-[42%]" strokeWidth={2.4} />;
}

function SettingsIcon() {
  return <Settings aria-hidden="true" className="h-[42%] w-[42%]" strokeWidth={2.4} />;
}

type GenerateWorkerResponse =
  | { id: number; ok: true; puzzle: GeneratedPuzzle }
  | { id: number; ok: false; error: string };

function makePuzzleInWorker(input: MakePuzzleInput): Promise<GeneratedPuzzle> {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.floor(Math.random() * 100000);
    const worker = new Worker(new URL('./alcazar-generate.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent<GenerateWorkerResponse>) => {
      if (event.data.id !== id) return;
      worker.terminate();

      if (event.data.ok) {
        resolve(event.data.puzzle);
        return;
      }

      reject(new Error(event.data.error));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };

    worker.postMessage({ id, ...input });
  });
}

function generatePuzzleSafely(input: MakePuzzleInput): Promise<GeneratedPuzzle> {
  return makePuzzleInWorker(input).catch(() => makePuzzle(input));
}

export default function HomePage() {
  const [scene, setScene] = useState<Scene>('menu');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [sizePreset, setSizePreset] = useState<SizePresetId>('6x6');
  const [holeMode, setHoleMode] = useState<HoleMode>('two-holes');
  const [kValue, setKValue] = useState(DEFAULT_K);
  const [customSeed, setCustomSeed] = useState(false);
  const [seedText, setSeedText] = useState(DEFAULT_SEED_TEXT);
  const [activeSeedText, setActiveSeedText] = useState(DEFAULT_SEED_TEXT);
  const [activeDifficulty, setActiveDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [puzzle, setPuzzle] = useState<GeneratedPuzzle | null>(null);
  const [internalEdges, setInternalEdges] = useState<Set<string>>(() => new Set());
  const [exitEdges, setExitEdges] = useState<Set<string>>(() => new Set());
  const [lockedInternalEdges, setLockedInternalEdges] = useState<Set<string>>(() => new Set());
  const [lockedExitEdges, setLockedExitEdges] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [puzzleStartedAtMs, setPuzzleStartedAtMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [solved, setSolved] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [setupPanelOpen, setSetupPanelOpen] = useState(true);
  const [undoStack, setUndoStack] = useState<DrawSnapshot[]>([]);
  const [activeCustomSeed, setActiveCustomSeed] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [saveData, setSaveData] = useState<SaveData>({
    bestTimes: {},
    puzzlesSolved: 0,
    currentRun: null,
    styleId: 'warm',
    vibration: true,
  });
  const [styleId, setStyleId] = useState<StyleId>('warm');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const setupPanelHandleStartY = useRef<number | null>(null);
  const setupPanelHandleSkipClick = useRef(false);
  const seedCopyResetId = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const outsidePointerId = useRef<number | null>(null);
  const outsideDragPointerId = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const stylePreset = STYLE_PRESETS.find((preset) => preset.id === styleId) ?? STYLE_PRESETS[0];
  const theme = stylePreset.colors;
  const themeStyle = {
    '--page-bg': theme.page,
    '--shell-bg': theme.shell,
    '--tile-a': theme.tileA,
    '--tile-b': theme.tileB,
    '--panel-bg': theme.panel,
    '--control-bg': theme.control,
    '--primary-bg': theme.primary,
    '--primary-hover': theme.primaryHover,
    '--text': theme.text,
    '--muted-text': theme.mutedText,
    '--board-bg': theme.board,
    '--dialog-bg': theme.dialog,
    '--border': theme.border,
    alignItems: 'safe center',
  } as CSSProperties;

  const stats = useMemo(() => analyzeDraw(puzzle, internalEdges, exitEdges), [exitEdges, internalEdges, puzzle]);
  const loopEdges = useMemo(
    () => (puzzle && puzzle.mode !== 'one-cycle' ? findInternalLoopEdges(puzzle.graph.n, internalEdges) : new Set<string>()),
    [internalEdges, puzzle]
  );
  const difficulty = Math.round((1 - kValue) * 100);
  const drawnEdgeCount = internalEdges.size + exitEdges.size;
  const unlockedEdgeCount = useMemo(() => {
    let count = 0;
    for (const key of internalEdges) {
      if (!lockedInternalEdges.has(key)) count += 1;
    }
    for (const key of exitEdges) {
      if (!lockedExitEdges.has(key)) count += 1;
    }
    return count;
  }, [exitEdges, internalEdges, lockedExitEdges, lockedInternalEdges]);
  const lockedEdgeCount = lockedInternalEdges.size + lockedExitEdges.size;
  const canContinue = (puzzle !== null && !solved) || saveData.currentRun !== null;
  const oneCycleUnavailable = holeMode === 'one-cycle' && (width * height) % 2 !== 0;

  const wallLines = useMemo(() => {
    if (!puzzle) return [];
    const lines = [];
    const { graph } = puzzle;

    for (let cell = 0; cell < graph.n; cell += 1) {
      for (const dir of [Dir.R, Dir.D]) {
        const next = neighborInDir(cell, dir, graph.w, graph.h);
        if (next !== -1 && (graph.adjMask[cell] & BIT[dir]) === 0) {
          lines.push(wallLineForInternal(graph.w, edgeKey(cell, next)));
        }
      }

      for (const dir of boundaryDirs(cell, graph.w, graph.h)) {
        if ((graph.holeMask[cell] & BIT[dir]) === 0) {
          lines.push(wallLineForBoundary(graph.w, cell, dir));
        }
      }
    }
    return lines;
  }, [puzzle]);

  const internalPathLines = useMemo(() => {
    if (!puzzle) return [];
    return [...internalEdges].map((key) => ({ key, ...lineForInternalEdge(puzzle.graph.w, key) }));
  }, [internalEdges, puzzle]);

  const exitPathLines = useMemo(() => {
    if (!puzzle) return [];
    return [...exitEdges].map((key) => ({ key, ...lineForExit(puzzle.graph.w, key) }));
  }, [exitEdges, puzzle]);

  const inkPoints = useMemo(() => {
    if (!drag || drag.inkPoints.length < 2) return '';
    return drag.inkPoints.map((point) => `${point.x},${point.y}`).join(' ');
  }, [drag]);

  const resetPuzzleState = useCallback((nextPuzzle: GeneratedPuzzle) => {
    setPuzzle(nextPuzzle);
    setInternalEdges(new Set());
    setExitEdges(new Set());
    setLockedInternalEdges(new Set());
    setLockedExitEdges(new Set());
    setUndoStack([]);
    setDrag(null);
    setPuzzleStartedAtMs(Date.now());
    setElapsedMs(0);
    setSolved(false);
    setShowClearDialog(false);
    setShowClearConfirm(false);
  }, []);

  const resetToPreview = useCallback(() => {
    setPuzzle(null);
    setInternalEdges(new Set());
    setExitEdges(new Set());
    setLockedInternalEdges(new Set());
    setLockedExitEdges(new Set());
    setUndoStack([]);
    setDrag(null);
    setPuzzleStartedAtMs(null);
    setElapsedMs(0);
    setSolved(false);
    setShowClearDialog(false);
    setShowClearConfirm(false);
    setSetupPanelOpen(true);
  }, []);

  const makeNewPuzzle = useCallback(() => {
    if (oneCycleUnavailable) return;

    const normalizedSeed = customSeed ? seedText.trim() || DEFAULT_SEED_TEXT : Date.now().toString();
    if (customSeed) setSeedText(normalizedSeed);
    setActiveSeedText(normalizedSeed);
    setActiveCustomSeed(customSeed);
    setSeedCopied(false);
    setActiveDifficulty(difficulty);
    setGenerating(true);
    window.setTimeout(() => {
      generatePuzzleSafely({ width, height, mode: holeMode, k: kValue, seedText: normalizedSeed, difficulty })
        .then((nextPuzzle) => {
          resetPuzzleState(nextPuzzle);
          setSetupPanelOpen(false);
          setScene('setup');
        })
        .catch(() => undefined)
        .finally(() => setGenerating(false));
    }, GENERATION_START_DELAY_MS);
  }, [customSeed, difficulty, height, holeMode, kValue, oneCycleUnavailable, resetPuzzleState, seedText, width]);

  const applySizePreset = useCallback((presetId: SizePresetId) => {
    resetToPreview();
    setSizePreset(presetId);
    const preset = SIZE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setWidth(preset.width);
    setHeight(preset.height);
  }, [resetToPreview]);

  useEffect(() => {
    const loaded = saveStore.load();
    setSaveData(loaded);
    setStyleId(loaded.styleId);
    setVibrationEnabled(loaded.vibration);
  }, []);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    setSaveData((previous) => {
      if (previous.styleId === styleId && previous.vibration === vibrationEnabled) return previous;
      const next = { ...previous, styleId, vibration: vibrationEnabled };
      saveStore.save(next);
      return next;
    });
  }, [styleId, vibrationEnabled]);

  const restoreSavedRun = useCallback((run: SavedRun) => {
    const nextK = 1 - run.difficulty / 100;
    const nextPuzzle = makePuzzle({
      width: run.width,
      height: run.height,
      mode: run.mode,
      k: nextK,
      seedText: run.seedText,
      difficulty: run.difficulty,
    });

    setWidth(run.width);
    setHeight(run.height);
    setSizePreset(findSizePresetId(run.width, run.height));
    setHoleMode(run.mode);
    setKValue(nextK);
    setCustomSeed(run.customSeed);
    setSeedText(run.seedText);
    setActiveSeedText(run.seedText);
    setActiveCustomSeed(run.customSeed);
    setActiveDifficulty(run.difficulty);
    setPuzzle(nextPuzzle);
    setInternalEdges(new Set(run.internalEdges));
    setExitEdges(new Set(run.exitEdges));
    setLockedInternalEdges(new Set(run.lockedInternalEdges));
    setLockedExitEdges(new Set(run.lockedExitEdges));
    setUndoStack([]);
    setDrag(null);
    setPuzzleStartedAtMs(run.startedAtMs);
    setElapsedMs(Math.max(0, Date.now() - run.startedAtMs));
    setSolved(false);
    setShowClearDialog(false);
    setShowClearConfirm(false);
    setSetupPanelOpen(false);
    setScene('setup');
  }, []);

  useEffect(() => {
    return () => {
      if (seedCopyResetId.current !== null) {
        window.clearTimeout(seedCopyResetId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (scene !== 'setup' || puzzleStartedAtMs === null || solved) return;
    const syncElapsed = () => setElapsedMs(Math.max(0, Date.now() - puzzleStartedAtMs));
    syncElapsed();
    const id = window.setInterval(syncElapsed, 250);
    return () => window.clearInterval(id);
  }, [puzzleStartedAtMs, scene, solved]);

  useEffect(() => {
    if (!puzzle || solved || puzzleStartedAtMs === null) return;

    const currentRun: SavedRun = {
      width: puzzle.graph.w,
      height: puzzle.graph.h,
      mode: puzzle.mode,
      difficulty: activeDifficulty,
      seedText: activeSeedText,
      customSeed: activeCustomSeed,
      startedAtMs: puzzleStartedAtMs,
      internalEdges: [...internalEdges],
      exitEdges: [...exitEdges],
      lockedInternalEdges: [...lockedInternalEdges],
      lockedExitEdges: [...lockedExitEdges],
    };

    setSaveData((previous) => {
      const next = { ...previous, currentRun };
      saveStore.save(next);
      return next;
    });
  }, [
    activeCustomSeed,
    activeDifficulty,
    activeSeedText,
    exitEdges,
    internalEdges,
    lockedExitEdges,
    lockedInternalEdges,
    puzzle,
    puzzleStartedAtMs,
    solved,
  ]);

  const markSolved = useCallback(() => {
    if (!puzzle) return;

    const nextElapsed = puzzleStartedAtMs === null ? elapsedMs : Math.max(0, Date.now() - puzzleStartedAtMs);
    const nextBestTimes = { ...saveData.bestTimes };
    const recordKey = bestTimeKey(puzzle.graph.w, puzzle.graph.h, activeDifficulty, puzzle.mode);

    if (!activeCustomSeed) {
      const previousBest = nextBestTimes[recordKey];
      if (previousBest === undefined || nextElapsed < previousBest) {
        nextBestTimes[recordKey] = nextElapsed;
      }
    }

    const nextSave = {
      bestTimes: nextBestTimes,
      puzzlesSolved: saveData.puzzlesSolved + 1,
      currentRun: null,
      styleId,
      vibration: vibrationEnabled,
    };
    saveStore.save(nextSave);
    setSaveData(nextSave);
    setElapsedMs(nextElapsed);
    setSolved(true);
    setShowClearDialog(true);
    setDrag(null);
    if (vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(35);
    }
  }, [activeCustomSeed, activeDifficulty, elapsedMs, puzzle, puzzleStartedAtMs, saveData, styleId, vibrationEnabled]);

  useEffect(() => {
    if (!puzzle || solved) return;
    const currentStats = analyzeDraw(puzzle, internalEdges, exitEdges);
    if (currentStats.solved) markSolved();
  }, [exitEdges, internalEdges, markSolved, puzzle, solved]);

  const commitDragSegments = useCallback(
    (segments: DragSegment[]) => {
      if (!puzzle || solved || segments.length === 0) return;

      const nextInternal = new Set(internalEdges);
      const nextExits = new Set(exitEdges);
      const initialInternal = new Set(internalEdges);
      const initialExits = new Set(exitEdges);
      const handledInternal = new Set<string>();
      const handledExits = new Set<string>();
      const hasNewSegment = segments.some((segment) =>
        segment.kind === 'internal' ? !initialInternal.has(segment.key) : !initialExits.has(segment.key)
      );
      let changed = 0;

      for (const segment of segments) {
        if (segment.kind === 'internal') {
          if (handledInternal.has(segment.key)) continue;
          handledInternal.add(segment.key);

          if (nextInternal.has(segment.key)) {
            if (hasNewSegment || !initialInternal.has(segment.key) || lockedInternalEdges.has(segment.key)) {
              continue;
            }
            nextInternal.delete(segment.key);
            changed += 1;
            continue;
          }

          const currentStats = analyzeDraw(puzzle, nextInternal, nextExits);
          if (
            !isOpenMove(puzzle, segment.from, segment.to) ||
            currentStats.degrees[segment.from] >= 2 ||
            currentStats.degrees[segment.to] >= 2
          ) {
            continue;
          }

          nextInternal.add(segment.key);
          changed += 1;
          continue;
        }

        if (handledExits.has(segment.key)) continue;
        handledExits.add(segment.key);

        if (nextExits.has(segment.key)) {
          if (hasNewSegment || !initialExits.has(segment.key) || lockedExitEdges.has(segment.key)) {
            continue;
          }
          nextExits.delete(segment.key);
          changed += 1;
          continue;
        }

        const hasExitOnCell =
          puzzle.graph.n > 1 && [...nextExits].some((item) => parseExitKey(item).cell === segment.cell);
        const currentStats = analyzeDraw(puzzle, nextInternal, nextExits);
        if (
          !hasOpenHole(puzzle, segment.cell, segment.dir) ||
          nextExits.size >= 2 ||
          hasExitOnCell ||
          currentStats.degrees[segment.cell] >= 2
        ) {
          continue;
        }

        nextExits.add(segment.key);
        changed += 1;
      }

      if (changed > 0) {
        setUndoStack((items) =>
          [
            ...items,
            {
              internalEdges: [...internalEdges],
              exitEdges: [...exitEdges],
            },
          ].slice(-30)
        );
        setInternalEdges(nextInternal);
        setExitEdges(nextExits);
        return;
      }
    },
    [
      exitEdges,
      internalEdges,
      lockedExitEdges,
      lockedInternalEdges,
      puzzle,
      solved,
    ]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!puzzle || solved || generating) return;
      const cell = pointerToCell(event, puzzle);
      if (cell === null) return;
      outsidePointerId.current = null;
      outsideDragPointerId.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({
        anchor: cell,
        pointerId: event.pointerId,
        inkPoints: [pointerToBoardPoint(event, puzzle)],
        segments: [],
      });
    },
    [generating, puzzle, solved]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (outsideDragPointerId.current === event.pointerId) return;
      if (!puzzle || !drag || solved) return;
      const sample = readPointerSample(event);
      setDrag((previous) => {
        if (!previous || previous.pointerId !== event.pointerId) return previous;
        return extendDragState(sample, puzzle, previous);
      });
    },
    [drag, puzzle, solved]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (outsideDragPointerId.current === event.pointerId) return;
      if (puzzle && drag && drag.pointerId === event.pointerId) {
        const finalDrag = extendDragState(readPointerSample(event), puzzle, drag);
        commitDragSegments(finalDrag.segments);
      }
      if (drag && event.currentTarget.hasPointerCapture(drag.pointerId)) {
        event.currentTarget.releasePointerCapture(drag.pointerId);
      }
      setDrag(null);
    },
    [commitDragSegments, drag, puzzle]
  );

  useEffect(() => {
    if (scene !== 'setup') return;

    const handleWindowPointerDown = (event: PointerEvent) => {
      if (!puzzle || solved || generating) return;
      const board = boardRef.current;
      if (!board) return;

      if (event.target instanceof Node && board.contains(event.target)) return;
      outsidePointerId.current = event.pointerId;
      outsideDragPointerId.current = null;
    };

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (!puzzle || solved || generating) return;
      const board = boardRef.current;
      if (!board) return;

      const sample = readNativePointerSample(event, board.getBoundingClientRect());

      if (outsideDragPointerId.current === event.pointerId) {
        setDrag((previous) => {
          if (!previous || previous.pointerId !== event.pointerId) return previous;
          return extendDragState(sample, puzzle, previous);
        });
        return;
      }

      if (outsidePointerId.current !== event.pointerId) return;

      const cell = sampleToCell(sample, puzzle);
      if (cell === null) return;

      outsidePointerId.current = null;
      outsideDragPointerId.current = event.pointerId;
      setDrag({
        anchor: cell,
        pointerId: event.pointerId,
        inkPoints: [sampleToBoardPoint(sample, puzzle)],
        segments: [],
      });
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      if (outsidePointerId.current === event.pointerId) {
        outsidePointerId.current = null;
      }

      if (outsideDragPointerId.current !== event.pointerId) return;

      const currentDrag = dragRef.current;
      const board = boardRef.current;
      if (currentDrag && puzzle && board) {
        const sample = readNativePointerSample(event, board.getBoundingClientRect());
        const finalDrag = extendDragState(sample, puzzle, currentDrag);
        commitDragSegments(finalDrag.segments);
      }

      outsideDragPointerId.current = null;
      setDrag(null);
    };

    window.addEventListener('pointerdown', handleWindowPointerDown);
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown);
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [commitDragSegments, generating, puzzle, scene, solved]);

  const toggleLocks = useCallback(() => {
    if (drawnEdgeCount === 0 && lockedEdgeCount === 0) return;

    if (unlockedEdgeCount > 0) {
      setLockedInternalEdges(new Set(internalEdges));
      setLockedExitEdges(new Set(exitEdges));
      return;
    }

    setLockedInternalEdges(new Set());
    setLockedExitEdges(new Set());
  }, [drawnEdgeCount, exitEdges, internalEdges, lockedEdgeCount, unlockedEdgeCount]);

  const clearDrawing = useCallback(() => {
    setInternalEdges(new Set([...internalEdges].filter((key) => lockedInternalEdges.has(key))));
    setExitEdges(new Set([...exitEdges].filter((key) => lockedExitEdges.has(key))));
    setUndoStack([]);
    setDrag(null);
    setSolved(false);
    setShowClearDialog(false);
    setShowClearConfirm(false);
  }, [exitEdges, internalEdges, lockedExitEdges, lockedInternalEdges]);

  const undoLastDrawing = useCallback(() => {
    if (!puzzle || solved || undoStack.length === 0) return;

    const snapshot = undoStack[undoStack.length - 1];
    const nextInternal = new Set(snapshot.internalEdges);
    const nextExits = new Set(snapshot.exitEdges);

    for (const key of lockedInternalEdges) nextInternal.add(key);
    for (const key of lockedExitEdges) nextExits.add(key);

    setInternalEdges(nextInternal);
    setExitEdges(nextExits);
    setUndoStack((items) => items.slice(0, -1));
    setDrag(null);
  }, [lockedExitEdges, lockedInternalEdges, puzzle, solved, undoStack]);

  const copyActiveSeed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeSeedText);
    } catch {
      return;
    }

    setSeedCopied(true);
    if (seedCopyResetId.current !== null) {
      window.clearTimeout(seedCopyResetId.current);
    }
    seedCopyResetId.current = window.setTimeout(() => setSeedCopied(false), 1200);
  }, [activeSeedText]);

  const restartSolvedPuzzle = useCallback(() => {
    if (!puzzle) return;

    let nextSeed = activeSeedText;
    if (!activeCustomSeed) {
      const timeSeed = Date.now().toString();
      nextSeed = timeSeed === activeSeedText ? (Date.now() + 1).toString() : timeSeed;
    }
    const nextK = 1 - activeDifficulty / 100;

    setShowClearDialog(false);
    setActiveSeedText(nextSeed);
    setSeedCopied(false);
    setGenerating(true);
    window.setTimeout(() => {
      generatePuzzleSafely({
        width: puzzle.graph.w,
        height: puzzle.graph.h,
        mode: puzzle.mode,
        k: nextK,
        seedText: nextSeed,
        difficulty: activeDifficulty,
      })
        .then((nextPuzzle) => {
          resetPuzzleState(nextPuzzle);
          setActiveCustomSeed(activeCustomSeed);
          setSetupPanelOpen(false);
        })
        .catch(() => undefined)
        .finally(() => setGenerating(false));
    }, GENERATION_START_DELAY_MS);
  }, [activeCustomSeed, activeDifficulty, activeSeedText, puzzle, resetPuzzleState]);

  const handleSetupPanelHandlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    setupPanelHandleStartY.current = event.clientY;
    setupPanelHandleSkipClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleSetupPanelHandlePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const startY = setupPanelHandleStartY.current;
    setupPanelHandleStartY.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (startY === null) return;

    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) >= 24) {
      setSetupPanelOpen(deltaY < 0);
      setupPanelHandleSkipClick.current = true;
    }
  }, []);

  const handleSetupPanelHandlePointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    setupPanelHandleStartY.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleSetupPanelHandleClick = useCallback(() => {
    if (setupPanelHandleSkipClick.current) {
      setupPanelHandleSkipClick.current = false;
      return;
    }

    setSetupPanelOpen((value) => !value);
  }, []);

  const lockButtonLabel = lockedEdgeCount > 0 && unlockedEdgeCount === 0 ? '잠금 해제' : '잠금';

  if (scene === 'menu') {
    return (
      <main
        className="alcazar-app flex h-screen-safe items-center justify-center overflow-hidden bg-[var(--page-bg)] text-[var(--text)]"
        style={themeStyle}
      >
        <section className="relative overflow-hidden bg-[var(--shell-bg)]" style={APP_SHELL_STYLE}>
          <nav
            className="absolute left-1/2 top-1/2 grid aspect-square w-[276%] -translate-x-1/2 -translate-y-1/2 grid-cols-6 grid-rows-6"
            aria-label="메인메뉴"
          >
            {Array.from({ length: 36 }, (_, cell) => {
              const x = cell % 6;
              const y = Math.floor(cell / 6);
              const tileTone = (x + y) % 2 === 0 ? 'bg-[var(--tile-a)]' : 'bg-[var(--tile-b)]';
              const buttonClass = `flex h-full w-full items-center justify-center ${tileTone} text-[var(--muted-text)] transition duration-150 hover:brightness-105 focus-visible:brightness-110 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35`;

              if (cell === 14) {
                return (
                  <button
                    key="menu-continue"
                    type="button"
                    onClick={() => {
                      if (!puzzle && saveData.currentRun) {
                        restoreSavedRun(saveData.currentRun);
                        return;
                      }
                      setSetupPanelOpen(false);
                      setScene('setup');
                    }}
                    disabled={!canContinue}
                    aria-label="이어하기"
                    className={buttonClass}
                  >
                    <ContinueIcon />
                  </button>
                );
              }

              if (cell === 15) {
                return (
                  <button
                    key="menu-create"
                    type="button"
                    onClick={() => {
                      resetToPreview();
                      setScene('setup');
                    }}
                    aria-label="문제 만들기"
                    className={buttonClass}
                  >
                    <CreateIcon />
                  </button>
                );
              }

              if (cell === 20) {
                return (
                  <button
                    key="menu-style"
                    type="button"
                    onClick={() => setScene('style')}
                    aria-label="스타일"
                    className={buttonClass}
                  >
                    <StyleIcon />
                  </button>
                );
              }

              if (cell === 21) {
                return (
                  <button
                    key="menu-settings"
                    type="button"
                    onClick={() => setScene('settings')}
                    aria-label="설정"
                    className={buttonClass}
                  >
                    <SettingsIcon />
                  </button>
                );
              }

              return <div key={`menu-tile-${cell}`} aria-hidden="true" className={tileTone} />;
            })}
          </nav>
        </section>
      </main>
    );
  }

  if (scene === 'style' || scene === 'settings') {
    const SceneIcon = scene === 'style' ? Palette : Settings;

    return (
      <main
        className="alcazar-app flex h-screen-safe items-center justify-center overflow-hidden bg-[var(--page-bg)] text-[var(--text)]"
        style={themeStyle}
      >
        <section
          className="flex flex-col justify-center bg-[var(--shell-bg)] px-[var(--ui-pad)] py-[calc(var(--ui-pad)*2)]"
          style={APP_SHELL_STYLE}
        >
          <div className="border border-[var(--border)] bg-[var(--dialog-bg)] p-[calc(var(--ui-pad)*1.5)] shadow-sm">
            <div className="flex justify-center text-[var(--muted-text)]">
              <SceneIcon aria-hidden="true" className="h-[calc(var(--ui-icon-lg)*1.75)] w-[calc(var(--ui-icon-lg)*1.75)]" />
            </div>
            {scene === 'style' ? (
              <div className="mt-[calc(var(--ui-pad)*2)] grid grid-cols-3 gap-[var(--ui-gap)]">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setStyleId(preset.id)}
                    aria-label={`${preset.id} style`}
                    className={`grid h-[calc(var(--ui-btn)*1.45)] grid-cols-2 grid-rows-2 overflow-hidden border ${
                      styleId === preset.id ? 'border-[var(--text)]' : 'border-[var(--border)]'
                    }`}
                  >
                    <span style={{ backgroundColor: preset.colors.shell }} />
                    <span style={{ backgroundColor: preset.colors.tileA }} />
                    <span style={{ backgroundColor: preset.colors.tileB }} />
                    <span style={{ backgroundColor: preset.colors.primary }} />
                  </button>
                ))}
              </div>
            ) : null}
            {scene === 'settings' ? (
              <div className="mt-[calc(var(--ui-pad)*1.5)] grid place-items-center gap-[var(--ui-gap)]">
                <button
                  type="button"
                  onClick={() => setVibrationEnabled((value) => !value)}
                  aria-label={vibrationEnabled ? '진동 켜짐' : '진동 꺼짐'}
                  className={`flex h-[calc(var(--ui-btn)*1.25)] w-[calc(var(--ui-btn)*1.25)] items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)] ${
                    vibrationEnabled ? 'shadow-[inset_0_0_0_3px_var(--text)]' : 'opacity-70'
                  }`}
                >
                  {vibrationEnabled ? (
                    <Vibrate aria-hidden="true" className="h-[var(--ui-icon-lg)] w-[var(--ui-icon-lg)]" />
                  ) : (
                    <VibrateOff aria-hidden="true" className="h-[var(--ui-icon-lg)] w-[var(--ui-icon-lg)]" />
                  )}
                </button>
              </div>
            ) : null}
            <div className="mt-[calc(var(--ui-pad)*2)] flex justify-end">
              <button
                type="button"
                onClick={() => setScene('menu')}
                aria-label="메뉴"
                className="flex h-[var(--ui-btn)] w-[var(--ui-btn)] items-center justify-center bg-[var(--primary-bg)] text-[var(--shell-bg)] transition hover:bg-[var(--primary-hover)]"
              >
                <Home aria-hidden="true" className="h-[var(--ui-icon-md)] w-[var(--ui-icon-md)]" />
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (scene === 'setup') {
    const boardWidth = puzzle?.graph.w ?? width;
    const boardHeight = puzzle?.graph.h ?? height;
    const boardRatio = boardWidth / boardHeight;
    const strokeScale = Math.min(1.22, 9 / Math.max(boardWidth, boardHeight));
    const pathStrokeWidth = Math.max(3.2, 8 * strokeScale);
    const inkStrokeWidth = Math.max(2.8, 7 * strokeScale);
    const wallStrokeWidth = Math.max(2.2, 5 * strokeScale);
    const boardMaxWidth = 'min(calc(100% - var(--ui-pad) * 2), 21.75rem)';
    const boardPositionClass = setupPanelOpen ? '-translate-y-24' : 'translate-y-0';
    const clearBestMs =
      puzzle && !activeCustomSeed
        ? saveData.bestTimes[bestTimeKey(puzzle.graph.w, puzzle.graph.h, activeDifficulty, puzzle.mode)] ?? null
        : null;

    return (
      <main
        className="alcazar-app flex h-screen-safe items-center justify-center overflow-hidden bg-[var(--page-bg)] text-[var(--text)]"
        style={themeStyle}
      >
        <div
          className="relative flex flex-col justify-center gap-[var(--ui-gap)] overflow-hidden bg-[var(--shell-bg)] px-[var(--ui-pad)] pb-[calc(var(--ui-btn)+0.5rem)] pt-[var(--ui-pad)]"
          style={APP_SHELL_STYLE}
        >
          <section className="contents">
            <div className="contents">
              <div
                ref={boardRef}
                className={`order-1 relative mx-auto shrink-0 touch-none select-none bg-[var(--board-bg)] transition-transform duration-300 ease-out ${boardPositionClass}`}
                style={{
                  aspectRatio: `${boardWidth} / ${boardHeight}`,
                  width: boardMaxWidth,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                role="application"
                aria-label={puzzle ? 'Alcazar 퍼즐판' : 'Alcazar 미리보기 판'}
              >
                {puzzle ? (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`${-SVG_PAD} ${-SVG_PAD} ${puzzle.graph.w + SVG_PAD * 2} ${
                      puzzle.graph.h + SVG_PAD * 2
                    }`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {Array.from({ length: puzzle.graph.n }, (_, cell) => {
                      const x = xOf(cell, puzzle.graph.w);
                      const y = yOf(cell, puzzle.graph.w);
                      return (
                        <rect
                          key={`floor-${cell}`}
                          x={x}
                          y={y}
                          width="1"
                          height="1"
                          fill={
                            stats.degrees[cell] >= 2
                              ? (x + y) % 2 === 0
                                ? theme.completedA
                                : theme.completedB
                              : (x + y) % 2 === 0
                                ? theme.tileA
                                : theme.tileB
                          }
                        />
                      );
                    })}
                    {internalPathLines.map(({ key, ...line }, index) => (
                      <line
                        key={`path-${key}-${index}`}
                        {...line}
                        stroke={
                          loopEdges.has(key)
                            ? theme.loop
                            : lockedInternalEdges.has(key)
                              ? theme.lockedPath
                              : theme.path
                        }
                        strokeLinecap="round"
                        strokeWidth={pathStrokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {exitPathLines.map(({ key, ...line }, index) => (
                      <line
                        key={`exit-${key}-${index}`}
                        {...line}
                        stroke={lockedExitEdges.has(key) ? theme.lockedPath : theme.path}
                        strokeLinecap="butt"
                        strokeWidth={pathStrokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {inkPoints ? (
                      <polyline
                        points={inkPoints}
                        fill="none"
                        stroke={theme.path}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.45"
                        strokeWidth={inkStrokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                    {wallLines.map((line, index) => (
                      <line
                        key={`wall-${index}`}
                        {...line}
                        stroke={theme.wall}
                        strokeLinecap="square"
                        strokeWidth={wallStrokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                ) : (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`${-SVG_PAD} ${-SVG_PAD} ${width + SVG_PAD * 2} ${height + SVG_PAD * 2}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {Array.from({ length: width * height }, (_, cell) => {
                      const x = xOf(cell, width);
                      const y = yOf(cell, width);
                      return (
                        <rect
                          key={`preview-floor-${cell}`}
                          x={x}
                          y={y}
                          width="1"
                          height="1"
                          fill={(x + y) % 2 === 0 ? theme.tileA : theme.tileB}
                        />
                      );
                    })}
                    <rect
                      x="0"
                      y="0"
                      width={width}
                      height={height}
                      fill="none"
                      stroke={theme.wall}
                      strokeWidth={wallStrokeWidth}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
                {generating ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
                    role="status"
                    aria-label="생성 중"
                  >
                    <LoaderCircle aria-hidden="true" className="h-12 w-12 animate-spin text-[var(--shell-bg)]" />
                  </div>
                ) : null}
              </div>
              <div
                className={`absolute inset-x-0 bottom-0 z-30 bg-[var(--panel-bg)] p-[var(--ui-gap)] shadow-[0_-12px_24px_rgba(47,33,24,0.18)] transition-transform duration-200 ease-out ${
                  setupPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%_-_2.5rem)]'
                }`}
              >
                <button
                  type="button"
                  onClick={handleSetupPanelHandleClick}
                  onPointerDown={handleSetupPanelHandlePointerDown}
                  onPointerUp={handleSetupPanelHandlePointerUp}
                  onPointerCancel={handleSetupPanelHandlePointerCancel}
                  aria-label={setupPanelOpen ? '생성창 접기' : '생성창 펼치기'}
                  className="flex h-[calc(var(--ui-btn)*0.72)] w-full touch-none items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)]"
                >
                  <span aria-hidden="true" className="h-[max(0.25rem,calc(var(--ui-gap)*0.55))] w-[calc(var(--ui-btn)*1.45)] bg-[var(--muted-text)]" />
                </button>
                <div className="grid gap-[var(--ui-gap)] pt-[var(--ui-gap)]">
                <fieldset aria-label="크기">
                  <legend className="sr-only">크기</legend>
                  <div className="grid grid-cols-5 gap-[var(--ui-gap)]">
                    {SIZE_PRESETS.map((preset) => (
                      <label
                        key={preset.id}
                        className="flex min-h-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] px-[var(--ui-gap)] py-[var(--ui-gap)] text-[var(--muted-text)] transition has-[:checked]:shadow-[inset_0_0_0_3px_var(--text)]"
                      >
                        <input
                          type="radio"
                          name="size-preset"
                          value={preset.id}
                          checked={sizePreset === preset.id}
                          onChange={() => applySizePreset(preset.id)}
                          aria-label={preset.label}
                          className="sr-only"
                        />
                        <SizePresetIcon cells={preset.iconCells} />
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset aria-label="난이도">
                  <legend className="sr-only">난이도</legend>
                  <div className="grid grid-cols-5 gap-[var(--ui-gap)]">
                    {DIFFICULTY_PRESETS.map((option) => (
                      <label
                        key={option}
                        className="flex min-h-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] px-[var(--ui-gap)] py-[var(--ui-gap)] text-[var(--muted-text)] transition has-[:checked]:shadow-[inset_0_0_0_3px_var(--text)]"
                      >
                        <input
                          type="radio"
                          name="difficulty"
                          value={option}
                          checked={difficulty === option}
                          onChange={() => setKValue(1 - option / 100)}
                          aria-label={`난이도 ${option}`}
                          className="sr-only"
                        />
                        <DifficultyIcon value={option} />
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex min-w-0 gap-[var(--ui-gap)]">
                  <button
                    type="button"
                    onClick={() => setCustomSeed((value) => !value)}
                    aria-label="커스텀 시드"
                    className={`flex h-[var(--ui-btn)] w-[var(--ui-btn)] shrink-0 items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)] transition ${
                      customSeed ? 'shadow-[inset_0_0_0_3px_var(--text)]' : 'hover:brightness-105'
                    }`}
                  >
                    <Sprout aria-hidden="true" className="h-[var(--ui-icon-md)] w-[var(--ui-icon-md)]" />
                  </button>
                  <input
                    type="text"
                    value={seedText}
                    onChange={(event) => setSeedText(event.target.value)}
                    disabled={!customSeed}
                    aria-label="시드"
                    className={`h-[var(--ui-btn)] min-w-0 flex-1 bg-[var(--control-bg)] px-[var(--ui-pad)] py-[var(--ui-gap)] font-medium outline-none ${
                      customSeed ? 'text-[var(--text)]' : 'text-[var(--muted-text)] opacity-70'
                    }`}
                    spellCheck={false}
                  />
                </div>

                <fieldset aria-label="입구">
                  <legend className="sr-only">입구</legend>
                  <div className="grid grid-cols-3 gap-[var(--ui-gap)]">
                    {[
                      { value: 'two-holes', label: '두개의 입구' },
                      { value: 'more-holes', label: '많은 입구' },
                      { value: 'one-cycle', label: '입구 없음' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex min-h-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] px-[var(--ui-gap)] py-[var(--ui-gap)] text-[var(--muted-text)] transition has-[:checked]:shadow-[inset_0_0_0_3px_var(--text)]"
                      >
                        <input
                          type="radio"
                          name="hole-mode"
                          value={option.value}
                          checked={holeMode === option.value}
                          onChange={() => setHoleMode(option.value as HoleMode)}
                          aria-label={option.label}
                          className="sr-only"
                        />
                        <EntranceIcon mode={option.value as HoleMode} />
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-[var(--ui-gap)]">
                  <button
                    type="button"
                    onClick={makeNewPuzzle}
                    disabled={generating || oneCycleUnavailable}
                    aria-label={oneCycleUnavailable ? '짝수 칸 필요' : generating ? '생성 중' : '퍼즐 생성'}
                    className="flex h-[var(--ui-btn)] items-center justify-center bg-[var(--primary-bg)] text-[var(--shell-bg)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <WandSparkles aria-hidden="true" className="h-[var(--ui-icon-md)] w-[var(--ui-icon-md)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setScene('menu')}
                    aria-label="메뉴"
                    className="flex h-[var(--ui-btn)] w-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)] hover:brightness-105"
                  >
                    <Home aria-hidden="true" className="h-[var(--ui-icon-sm)] w-[var(--ui-icon-sm)]" />
                  </button>
                </div>
              </div>
            </div>
            </div>
          </section>

          <div
            className={`relative z-20 order-2 flex shrink-0 items-center justify-center gap-[var(--ui-gap)] p-[var(--ui-gap)] transition-transform duration-300 ease-out ${boardPositionClass}`}
          >
            <div className="flex h-[var(--ui-btn)] min-w-[calc(var(--ui-btn)*2.05)] items-center justify-center gap-[var(--ui-gap)] px-[var(--ui-gap)] font-semibold">
              <Clock aria-hidden="true" className="h-[var(--ui-icon-sm)] w-[var(--ui-icon-sm)] text-[var(--muted-text)]" />
              <span className="tabular-nums">{formatTime(puzzle ? elapsedMs : 0)}</span>
            </div>
            <button
              type="button"
              onClick={undoLastDrawing}
              disabled={!puzzle || solved || undoStack.length === 0}
              aria-label="되돌리기"
              className="flex h-[var(--ui-btn)] w-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Undo2 aria-hidden="true" className="h-[var(--ui-icon-sm)] w-[var(--ui-icon-sm)]" />
            </button>
            <button
              type="button"
              onClick={toggleLocks}
              disabled={!puzzle || (drawnEdgeCount === 0 && lockedEdgeCount === 0)}
              aria-label={lockButtonLabel}
              className="flex h-[var(--ui-btn)] w-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <LockIcon unlocked={lockButtonLabel === '잠금 해제'} />
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={!puzzle || unlockedEdgeCount === 0}
              aria-label="지우기"
              className="flex h-[var(--ui-btn)] w-[var(--ui-btn)] items-center justify-center bg-[var(--control-bg)] text-[var(--muted-text)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <EraserIcon />
            </button>
          </div>
          {showClearDialog && puzzle ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-title"
            >
              <div className="w-full max-w-sm border border-[var(--border)] bg-[var(--dialog-bg)] p-5 shadow-xl">
                <h2 id="clear-title" className="sr-only">
                  클리어
                </h2>
                <div className="flex items-center justify-center gap-8 text-[var(--primary-bg)]">
                  <span className="scale-150">
                    <SizePresetIcon cells={Math.min(6, Math.max(2, Math.round(puzzle.graph.w / 3)))} />
                  </span>
                  <span className="scale-150">
                    <DifficultyIcon value={activeDifficulty as (typeof DIFFICULTY_PRESETS)[number]} />
                  </span>
                </div>
                <div className="mt-8 flex items-center justify-center gap-3 text-[var(--muted-text)]">
                  <Clock aria-hidden="true" className="h-10 w-10" />
                  <span className="text-4xl font-semibold tabular-nums">{formatRecordTime(elapsedMs)}</span>
                </div>
                <div className="mt-2 flex h-7 items-center justify-center gap-2 text-[var(--muted-text)] opacity-80">
                  {activeCustomSeed ? (
                    <Sprout aria-label="시드런" className="h-5 w-5" />
                  ) : (
                    <>
                      <Clock aria-hidden="true" className="h-4 w-4" />
                      <span className="text-base font-semibold tabular-nums">{formatRecordTime(clearBestMs)}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={copyActiveSeed}
                  aria-label="시드 복사"
                  className={`mx-auto mt-4 flex max-w-full items-center gap-2 bg-[var(--control-bg)] px-3 py-2 text-sm font-semibold text-[var(--muted-text)] transition ${
                    seedCopied ? 'brightness-110' : 'hover:brightness-105'
                  }`}
                >
                  <Sprout aria-hidden="true" className="h-5 w-5 shrink-0" />
                  <span className="truncate">{activeSeedText}</span>
                  {seedCopied ? (
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : (
                    <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />
                  )}
                </button>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearDialog(false)}
                    aria-label="닫기"
                    className="flex h-11 w-11 items-center justify-center border border-[var(--border)] text-[var(--muted-text)] hover:brightness-105"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowClearDialog(false);
                      setScene('menu');
                    }}
                    aria-label="메뉴"
                    className="flex h-11 w-11 items-center justify-center bg-[var(--primary-bg)] text-[var(--shell-bg)] hover:bg-[var(--primary-hover)]"
                  >
                    <Home aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={restartSolvedPuzzle}
                    aria-label="재시작"
                    className="flex h-11 w-11 items-center justify-center bg-[var(--primary-bg)] text-[var(--shell-bg)] hover:bg-[var(--primary-hover)]"
                  >
                    <RotateCcw aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {showClearConfirm ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-confirm-title"
            >
              <div className="w-full max-w-sm border border-[var(--border)] bg-[var(--dialog-bg)] p-5 shadow-xl">
                <h2 id="clear-confirm-title" className="sr-only">
                  그은 선을 지울까요?
                </h2>
                <div aria-hidden="true" className="flex items-center justify-center text-[var(--primary-bg)]">
                  <Eraser className="h-10 w-10" />
                  <span className="ml-1 text-3xl font-bold leading-none">?</span>
                </div>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    aria-label="취소"
                    className="flex h-11 w-11 items-center justify-center border border-[var(--border)] text-[var(--muted-text)] hover:brightness-105"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={clearDrawing}
                    aria-label="지우기"
                    className="flex h-11 w-11 items-center justify-center bg-[var(--primary-bg)] text-[var(--shell-bg)] hover:bg-[var(--primary-hover)]"
                  >
                    <EraserIcon />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return null;
}

