export enum Dir {
  R = 0,
  D = 1,
  L = 2,
  U = 3,
}

export const BIT = [1, 2, 4, 8] as const;
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
export const OPP = [2, 3, 0, 1] as const;

export type Cell = number;
export type HoleMode = 'two-holes' | 'multi-holes' | 'more-holes' | 'one-cycle';

export interface RNG {
  (): number;
}

export interface PathState {
  w: number;
  h: number;
  n: number;
  path: Int32Array;
  pos: Int32Array;
}

export interface PuzzleGraph {
  w: number;
  h: number;
  n: number;
  adjMask: Uint8Array;
  solMask: Uint8Array;
  holeMask: Uint8Array;
}

export interface GenerateOptions {
  solutionDeadlineMs: number;
  totalDeadlineMs: number;
  minBackbiteFactor: number;
  maxBackbiteFactor: number;
  restoreRatio: number;
  profileVerify: boolean;
  verificationShortcuts: VerificationShortcuts;
}

export type GenerateOptionsInput = Partial<Omit<GenerateOptions, 'verificationShortcuts'>> & {
  verificationShortcuts?: Partial<VerificationShortcuts>;
};

export interface VerificationShortcuts {
  candidateUsagePrune: boolean;
  forcedCandidateNext: boolean;
  forcedTightCell: boolean;
  degreeFeasibilityPrune: boolean;
  connectivityPrune: boolean;
  parityPrune: boolean;
  forcedMovePrune: boolean;
  choiceOrdering: boolean;
}

export const DEFAULT_VERIFICATION_SHORTCUTS: VerificationShortcuts = {
  candidateUsagePrune: true,
  forcedCandidateNext: false,
  forcedTightCell: true,
  degreeFeasibilityPrune: false,
  connectivityPrune: true,
  parityPrune: false,
  forcedMovePrune: false,
  choiceOrdering: true,
};

export interface GeneratedPuzzle {
  graph: PuzzleGraph;
  solution: PathState;
  mode: HoleMode;
  maxRemovedWalls: number;
  restoredWalls: number;
  timedOutCandidates: number;
  timeoutSummary: TimeoutSummary;
  timings: GenerateTimings;
  deadlineExceeded: boolean;
  seed: number;
}

export interface TimeoutSummary {
  total: number;
  internal: number;
  hole: number;
  examples: string[];
}

export interface GenerateTimings {
  totalMs: number;
  optionsMs: number;
  solutionMs: number;
  initialPuzzleMs: number;
  carveMs: number;
  carve: CarveTimings;
}

export interface CarveTimings {
  totalMs: number;
  internalCandidateMs: number;
  holeCandidateMs: number;
  candidateShuffleMs: number;
  candidateLoopMs: number;
  applyMs: number;
  verifyMs: number;
  undoMs: number;
  restoreMs: number;
  restoreShuffleMs: number;
  restoreUndoMs: number;
  candidateCount: number;
  internalCandidateCount: number;
  holeCandidateCount: number;
  checkedCandidates: number;
  skippedCandidates: number;
  acceptedCandidates: number;
  alternativeCandidates: number;
  timeoutCandidates: number;
  deadlineExceeded: boolean;
  verify: VerifyTimings;
}

export interface VerifyTimings {
  totalMs: number;
  setupMs: number;
  searchMs: number;
  resetMs: number;
  quickRejectMs: number;
  endpointPairMs: number;
  propagateMs: number;
  branchMs: number;
  prepareChoicesMs: number;
  candidateUsagePruneMs: number;
  degreeFeasibilityPruneMs: number;
  connectivityPruneMs: number;
  parityPruneMs: number;
  forcedMovePruneMs: number;
  advanceMs: number;
  backtrackMs: number;
  terminalMs: number;
  calls: number;
  startAttempts: number;
  searchSteps: number;
  terminalChecks: number;
}

export type Candidate =
  | { kind: 'internal'; a: Cell; b: Cell; dirAB: Dir }
  | { kind: 'hole'; cell: Cell; dir: Dir };

export type VerifyResult = 'unique' | 'alternative' | 'timeout';

export function createSeededRng(seed: number): RNG {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function id(x: number, y: number, w: number): Cell {
  return y * w + x;
}

export function xOf(cell: Cell, w: number) {
  return cell % w;
}

export function yOf(cell: Cell, w: number) {
  return Math.floor(cell / w);
}

export function inBounds(x: number, y: number, w: number, h: number) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function isBoundaryCell(cell: Cell, w: number, h: number) {
  const x = xOf(cell, w);
  const y = yOf(cell, w);
  return x === 0 || y === 0 || x === w - 1 || y === h - 1;
}

export function boundaryDirs(cell: Cell, w: number, h: number): Dir[] {
  const x = xOf(cell, w);
  const y = yOf(cell, w);
  const dirs: Dir[] = [];
  if (x === w - 1) dirs.push(Dir.R);
  if (y === h - 1) dirs.push(Dir.D);
  if (x === 0) dirs.push(Dir.L);
  if (y === 0) dirs.push(Dir.U);
  return dirs;
}

export function areAdjacent(a: Cell, b: Cell, w: number) {
  const ax = xOf(a, w);
  const ay = yOf(a, w);
  const bx = xOf(b, w);
  const by = yOf(b, w);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function directionBetween(a: Cell, b: Cell, w: number): Dir {
  const ax = xOf(a, w);
  const ay = yOf(a, w);
  const bx = xOf(b, w);
  const by = yOf(b, w);
  if (bx === ax + 1 && by === ay) return Dir.R;
  if (bx === ax && by === ay + 1) return Dir.D;
  if (bx === ax - 1 && by === ay) return Dir.L;
  if (bx === ax && by === ay - 1) return Dir.U;
  throw new Error('cells are not adjacent');
}

export function neighborInDir(cell: Cell, dir: Dir, w: number, h: number): Cell | -1 {
  const nx = xOf(cell, w) + DX[dir];
  const ny = yOf(cell, w) + DY[dir];
  return inBounds(nx, ny, w, h) ? id(nx, ny, w) : -1;
}

export function neighbors4(cell: Cell, w: number, h: number, out: number[]): void {
  out.length = 0;
  for (let dir = 0; dir < 4; dir += 1) {
    const next = neighborInDir(cell, dir as Dir, w, h);
    if (next !== -1) out.push(next);
  }
}

export function makeSnakePath(w: number, h: number): PathState {
  const n = w * h;
  const path = new Int32Array(n);
  const pos = new Int32Array(n);
  let cursor = 0;

  for (let y = 0; y < h; y += 1) {
    if (y % 2 === 0) {
      for (let x = 0; x < w; x += 1) {
        const cell = id(x, y, w);
        path[cursor] = cell;
        pos[cell] = cursor;
        cursor += 1;
      }
    } else {
      for (let x = w - 1; x >= 0; x -= 1) {
        const cell = id(x, y, w);
        path[cursor] = cell;
        pos[cell] = cursor;
        cursor += 1;
      }
    }
  }

  return { w, h, n, path, pos };
}

export function clonePathState(state: PathState): PathState {
  return {
    w: state.w,
    h: state.h,
    n: state.n,
    path: new Int32Array(state.path),
    pos: new Int32Array(state.pos),
  };
}

export function reverseRange(path: Int32Array, pos: Int32Array, lo: number, hi: number): void {
  while (lo < hi) {
    const left = path[lo];
    const right = path[hi];
    path[lo] = right;
    path[hi] = left;
    pos[right] = lo;
    pos[left] = hi;
    lo += 1;
    hi -= 1;
  }
}

export function hasBoundaryEndpoints(state: PathState): boolean {
  return (
    isBoundaryCell(state.path[0], state.w, state.h) &&
    isBoundaryCell(state.path[state.n - 1], state.w, state.h)
  );
}

export function tryBackbiteOnce(state: PathState, rng: RNG, scratchNeighbors: number[]): boolean {
  const useStart = rng() < 0.5;
  const endpointIndex = useStart ? 0 : state.n - 1;
  const endpoint = state.path[endpointIndex];
  neighbors4(endpoint, state.w, state.h, scratchNeighbors);
  shuffleInPlace(scratchNeighbors, rng);

  for (const neighbor of scratchNeighbors) {
    const k = state.pos[neighbor];
    if (useStart) {
      if (k <= 1) continue;
      reverseRange(state.path, state.pos, 0, k - 1);
      return true;
    }

    if (k >= state.n - 2) continue;
    reverseRange(state.path, state.pos, k + 1, state.n - 1);
    return true;
  }

  return false;
}

export function generateSolutionPath(
  w: number,
  h: number,
  rng: RNG,
  options: GenerateOptions
): PathState {
  const state = makeSnakePath(w, h);
  const n = state.n;
  const minMoves = randomInt(
    rng,
    options.minBackbiteFactor * n,
    Math.floor((options.minBackbiteFactor + 70) * n)
  );
  const maxMoves = randomInt(
    rng,
    Math.floor(options.maxBackbiteFactor * 0.5 * n),
    options.maxBackbiteFactor * n
  );
  const deadline = now() + options.solutionDeadlineMs;
  const scratchNeighbors: number[] = [];
  const cloneEvery = Math.max(8, Math.floor(n / 3));
  let lastBoundaryCandidate: PathState | null = hasBoundaryEndpoints(state) ? clonePathState(state) : null;

  for (let i = 0; i < maxMoves && now() < deadline; i += 1) {
    tryBackbiteOnce(state, rng, scratchNeighbors);
    if (i < minMoves || !hasBoundaryEndpoints(state)) continue;

    if (rng() < 0.01) return clonePathState(state);
    if (i % cloneEvery === 0 || lastBoundaryCandidate === null) {
      lastBoundaryCandidate = clonePathState(state);
    }
  }

  return lastBoundaryCandidate ?? makeSnakePath(w, h);
}

export function generateSolutionCycle(
  w: number,
  h: number,
  rng: RNG,
  options?: Pick<GenerateOptions, 'solutionDeadlineMs' | 'minBackbiteFactor' | 'maxBackbiteFactor'>
): PathState {
  if ((w * h) % 2 !== 0) {
    throw new Error('Hamiltonian cycle generation requires an even number of cells.');
  }

  const cycleMask = w % 2 === 0 && h % 2 === 0
    ? makeBlockSplicedCycleMask(w, h, rng)
    : makeFallbackCycleMask(w, h);

  const n = w * h;
  const minMoves = randomInt(
    rng,
    (options?.minBackbiteFactor ?? 80) * n,
    Math.floor(((options?.minBackbiteFactor ?? 80) + 70) * n)
  );
  const maxMoves = randomInt(
    rng,
    Math.floor((options?.maxBackbiteFactor ?? 500) * 0.5 * n),
    (options?.maxBackbiteFactor ?? 500) * n
  );
  const deadline = now() + (options?.solutionDeadlineMs ?? 120);
  const scratch: CycleConnectivityScratch = {
    stack: new Int32Array(n),
    seen: new Int32Array(n),
    stamp: 0,
  };
  let accepted = 0;

  for (let i = 0; i < maxMoves && now() < deadline; i += 1) {
    if (tryRandomCycleFlip(cycleMask, w, h, rng, scratch)) accepted += 1;
    if (i >= minMoves && accepted > n && rng() < 0.01) break;
  }

  return cyclePathFromMask(w, h, cycleMask, rng);
}

function makeEvenWidthCycleCoords(w: number, h: number): ReadonlyArray<readonly [number, number]> {
  const coords: Array<readonly [number, number]> = [];

  for (let x = 0; x < w; x += 1) coords.push([x, 0]);

  let downward = true;
  for (let x = w - 1; x >= 1; x -= 1) {
    if (downward) {
      for (let y = 1; y < h; y += 1) coords.push([x, y]);
    } else {
      for (let y = h - 1; y >= 1; y -= 1) coords.push([x, y]);
    }
    downward = !downward;
  }

  for (let y = h - 1; y >= 1; y -= 1) coords.push([0, y]);
  return coords;
}

function makeFallbackCycleMask(w: number, h: number) {
  const coords = w % 2 === 0
    ? makeEvenWidthCycleCoords(w, h)
    : makeEvenWidthCycleCoords(h, w).map(([x, y]) => [y, x] as const);
  const cycleMask = new Uint8Array(w * h);

  for (let i = 0; i < coords.length; i += 1) {
    const [x, y] = coords[i];
    const [nextX, nextY] = coords[(i + 1) % coords.length];
    setCycleMaskEdge(cycleMask, id(x, y, w), id(nextX, nextY, w), w, true);
  }

  return cycleMask;
}

function makeBlockSplicedCycleMask(w: number, h: number, rng: RNG) {
  const cycleMask = new Uint8Array(w * h);
  const blockW = Math.floor(w / 2);
  const blockH = Math.floor(h / 2);

  for (let by = 0; by < blockH; by += 1) {
    for (let bx = 0; bx < blockW; bx += 1) {
      const nw = blockCell(bx, by, 0, 0, w);
      const ne = blockCell(bx, by, 1, 0, w);
      const sw = blockCell(bx, by, 0, 1, w);
      const se = blockCell(bx, by, 1, 1, w);
      setCycleMaskEdge(cycleMask, nw, ne, w, true);
      setCycleMaskEdge(cycleMask, ne, se, w, true);
      setCycleMaskEdge(cycleMask, se, sw, w, true);
      setCycleMaskEdge(cycleMask, sw, nw, w, true);
    }
  }

  for (const edge of makeRandomSpanningTreeEdges(blockW, blockH, rng)) {
    spliceBlockCycles(cycleMask, w, edge.a, edge.b, blockW);
  }

  return cycleMask;
}

interface BlockTreeEdge {
  a: number;
  b: number;
}

function makeRandomSpanningTreeEdges(blockW: number, blockH: number, rng: RNG) {
  const total = blockW * blockH;
  const start = Math.floor(rng() * total);
  const visited = new Uint8Array(total);
  const stack = [start];
  const edges: BlockTreeEdge[] = [];
  visited[start] = 1;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const x = current % blockW;
    const y = Math.floor(current / blockW);
    const nextBlocks: number[] = [];

    if (x + 1 < blockW && visited[current + 1] === 0) nextBlocks.push(current + 1);
    if (y + 1 < blockH && visited[current + blockW] === 0) nextBlocks.push(current + blockW);
    if (x > 0 && visited[current - 1] === 0) nextBlocks.push(current - 1);
    if (y > 0 && visited[current - blockW] === 0) nextBlocks.push(current - blockW);

    if (nextBlocks.length === 0) {
      stack.pop();
      continue;
    }

    const next = pick(rng, nextBlocks);
    visited[next] = 1;
    edges.push({ a: current, b: next });
    stack.push(next);
  }

  return edges;
}

function spliceBlockCycles(
  cycleMask: Uint8Array,
  w: number,
  blockA: number,
  blockB: number,
  blockW: number
) {
  const ax = blockA % blockW;
  const ay = Math.floor(blockA / blockW);
  const bx = blockB % blockW;
  const by = Math.floor(blockB / blockW);

  if (bx === ax + 1 && by === ay) {
    spliceHorizontalBlockCycles(cycleMask, w, ax, ay, bx, by);
    return;
  }
  if (bx === ax - 1 && by === ay) {
    spliceHorizontalBlockCycles(cycleMask, w, bx, by, ax, ay);
    return;
  }
  if (by === ay + 1 && bx === ax) {
    spliceVerticalBlockCycles(cycleMask, w, ax, ay, bx, by);
    return;
  }
  if (by === ay - 1 && bx === ax) {
    spliceVerticalBlockCycles(cycleMask, w, bx, by, ax, ay);
  }
}

function spliceHorizontalBlockCycles(
  cycleMask: Uint8Array,
  w: number,
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number
) {
  const leftNe = blockCell(leftX, leftY, 1, 0, w);
  const leftSe = blockCell(leftX, leftY, 1, 1, w);
  const rightNw = blockCell(rightX, rightY, 0, 0, w);
  const rightSw = blockCell(rightX, rightY, 0, 1, w);

  setCycleMaskEdge(cycleMask, leftNe, leftSe, w, false);
  setCycleMaskEdge(cycleMask, rightNw, rightSw, w, false);
  setCycleMaskEdge(cycleMask, leftNe, rightNw, w, true);
  setCycleMaskEdge(cycleMask, leftSe, rightSw, w, true);
}

function spliceVerticalBlockCycles(
  cycleMask: Uint8Array,
  w: number,
  topX: number,
  topY: number,
  bottomX: number,
  bottomY: number
) {
  const topSw = blockCell(topX, topY, 0, 1, w);
  const topSe = blockCell(topX, topY, 1, 1, w);
  const bottomNw = blockCell(bottomX, bottomY, 0, 0, w);
  const bottomNe = blockCell(bottomX, bottomY, 1, 0, w);

  setCycleMaskEdge(cycleMask, topSw, topSe, w, false);
  setCycleMaskEdge(cycleMask, bottomNw, bottomNe, w, false);
  setCycleMaskEdge(cycleMask, topSw, bottomNw, w, true);
  setCycleMaskEdge(cycleMask, topSe, bottomNe, w, true);
}

function blockCell(blockX: number, blockY: number, dx: 0 | 1, dy: 0 | 1, w: number) {
  return id(blockX * 2 + dx, blockY * 2 + dy, w);
}

interface CycleConnectivityScratch {
  stack: Int32Array;
  seen: Int32Array;
  stamp: number;
}

function tryRandomCycleFlip(
  cycleMask: Uint8Array,
  w: number,
  h: number,
  rng: RNG,
  scratch: CycleConnectivityScratch
) {
  const x = Math.floor(rng() * (w - 1));
  const y = Math.floor(rng() * (h - 1));
  const topLeft = id(x, y, w);
  const topRight = id(x + 1, y, w);
  const bottomRight = id(x + 1, y + 1, w);
  const bottomLeft = id(x, y + 1, w);

  const top = hasCycleMaskEdge(cycleMask, topLeft, topRight, w);
  const right = hasCycleMaskEdge(cycleMask, topRight, bottomRight, w);
  const bottom = hasCycleMaskEdge(cycleMask, bottomLeft, bottomRight, w);
  const left = hasCycleMaskEdge(cycleMask, topLeft, bottomLeft, w);

  if (top && bottom && !right && !left) {
    setCycleMaskEdge(cycleMask, topLeft, topRight, w, false);
    setCycleMaskEdge(cycleMask, bottomLeft, bottomRight, w, false);
    setCycleMaskEdge(cycleMask, topRight, bottomRight, w, true);
    setCycleMaskEdge(cycleMask, topLeft, bottomLeft, w, true);

    if (isSingleCycleMask(cycleMask, w, h, scratch)) return true;

    setCycleMaskEdge(cycleMask, topLeft, topRight, w, true);
    setCycleMaskEdge(cycleMask, bottomLeft, bottomRight, w, true);
    setCycleMaskEdge(cycleMask, topRight, bottomRight, w, false);
    setCycleMaskEdge(cycleMask, topLeft, bottomLeft, w, false);
    return false;
  }

  if (right && left && !top && !bottom) {
    setCycleMaskEdge(cycleMask, topRight, bottomRight, w, false);
    setCycleMaskEdge(cycleMask, topLeft, bottomLeft, w, false);
    setCycleMaskEdge(cycleMask, topLeft, topRight, w, true);
    setCycleMaskEdge(cycleMask, bottomLeft, bottomRight, w, true);

    if (isSingleCycleMask(cycleMask, w, h, scratch)) return true;

    setCycleMaskEdge(cycleMask, topRight, bottomRight, w, true);
    setCycleMaskEdge(cycleMask, topLeft, bottomLeft, w, true);
    setCycleMaskEdge(cycleMask, topLeft, topRight, w, false);
    setCycleMaskEdge(cycleMask, bottomLeft, bottomRight, w, false);
  }

  return false;
}

function hasCycleMaskEdge(cycleMask: Uint8Array, a: Cell, b: Cell, w: number) {
  const dir = directionBetween(a, b, w);
  return (cycleMask[a] & BIT[dir]) !== 0;
}

function setCycleMaskEdge(cycleMask: Uint8Array, a: Cell, b: Cell, w: number, open: boolean) {
  const dir = directionBetween(a, b, w);
  if (open) {
    cycleMask[a] |= BIT[dir];
    cycleMask[b] |= BIT[OPP[dir]];
  } else {
    cycleMask[a] &= ~BIT[dir];
    cycleMask[b] &= ~BIT[OPP[dir]];
  }
}

function isSingleCycleMask(
  cycleMask: Uint8Array,
  w: number,
  h: number,
  scratch: CycleConnectivityScratch
) {
  const n = w * h;
  for (let cell = 0; cell < n; cell += 1) {
    if (bitCount(cycleMask[cell]) !== 2) return false;
  }

  scratch.stamp += 1;
  let head = 0;
  let tail = 0;
  let seenCount = 1;
  scratch.stack[tail] = 0;
  tail += 1;
  scratch.seen[0] = scratch.stamp;

  while (head < tail) {
    const cell = scratch.stack[head];
    head += 1;

    for (let dir = 0; dir < 4; dir += 1) {
      if ((cycleMask[cell] & BIT[dir]) === 0) continue;
      const next = neighborInDir(cell, dir as Dir, w, h);
      if (next === -1 || scratch.seen[next] === scratch.stamp) continue;
      scratch.seen[next] = scratch.stamp;
      scratch.stack[tail] = next;
      tail += 1;
      seenCount += 1;
    }
  }

  return seenCount === n;
}

function cyclePathFromMask(w: number, h: number, cycleMask: Uint8Array, rng: RNG): PathState {
  const n = w * h;
  const path = new Int32Array(n);
  const pos = new Int32Array(n);
  const visited = new Uint8Array(n);
  const neighbors: number[] = [];
  let previous = -1;
  let current = Math.floor(rng() * n);

  for (let i = 0; i < n; i += 1) {
    path[i] = current;
    pos[current] = i;
    visited[current] = 1;
    collectCycleMaskNeighbors(cycleMask, current, w, h, neighbors);

    if (i === n - 1) break;
    const viable = neighbors.filter((next) => next !== previous && visited[next] === 0);
    if (viable.length === 0) throw new Error('invalid Hamiltonian cycle mask');
    const next = i === 0 ? pick(rng, viable) : viable[0];
    previous = current;
    current = next;
  }

  return { w, h, n, path, pos };
}

function collectCycleMaskNeighbors(
  cycleMask: Uint8Array,
  cell: Cell,
  w: number,
  h: number,
  out: number[]
) {
  out.length = 0;
  for (let dir = 0; dir < 4; dir += 1) {
    if ((cycleMask[cell] & BIT[dir]) === 0) continue;
    const next = neighborInDir(cell, dir as Dir, w, h);
    if (next !== -1) out.push(next);
  }
}

export function buildInitialPuzzle(solution: PathState, rng: RNG): PuzzleGraph {
  const graph: PuzzleGraph = {
    w: solution.w,
    h: solution.h,
    n: solution.n,
    adjMask: new Uint8Array(solution.n),
    solMask: new Uint8Array(solution.n),
    holeMask: new Uint8Array(solution.n),
  };

  for (let i = 1; i < solution.n; i += 1) {
    const a = solution.path[i - 1];
    const b = solution.path[i];
    openInternalEdge(graph, a, b);
    const dir = directionBetween(a, b, graph.w);
    graph.solMask[a] |= BIT[dir];
    graph.solMask[b] |= BIT[OPP[dir]];
  }

  const start = solution.path[0];
  const end = solution.path[solution.n - 1];
  openBoundaryHole(graph, start, pick(rng, boundaryDirs(start, graph.w, graph.h)));
  openBoundaryHole(graph, end, pick(rng, boundaryDirs(end, graph.w, graph.h)));
  return graph;
}

export function buildInitialCyclePuzzle(solution: PathState): PuzzleGraph {
  const graph: PuzzleGraph = {
    w: solution.w,
    h: solution.h,
    n: solution.n,
    adjMask: new Uint8Array(solution.n),
    solMask: new Uint8Array(solution.n),
    holeMask: new Uint8Array(solution.n),
  };

  for (let i = 0; i < solution.n; i += 1) {
    const a = solution.path[i];
    const b = solution.path[(i + 1) % solution.n];
    openInternalEdge(graph, a, b);
    const dir = directionBetween(a, b, graph.w);
    graph.solMask[a] |= BIT[dir];
    graph.solMask[b] |= BIT[OPP[dir]];
  }

  return graph;
}

export function openInternalEdge(graph: PuzzleGraph, a: Cell, b: Cell): void {
  const dir = directionBetween(a, b, graph.w);
  graph.adjMask[a] |= BIT[dir];
  graph.adjMask[b] |= BIT[OPP[dir]];
}

export function closeInternalEdge(graph: PuzzleGraph, a: Cell, b: Cell): void {
  const dir = directionBetween(a, b, graph.w);
  graph.adjMask[a] &= ~BIT[dir];
  graph.adjMask[b] &= ~BIT[OPP[dir]];
}

export function openBoundaryHole(graph: PuzzleGraph, cell: Cell, dir: Dir): void {
  graph.holeMask[cell] |= BIT[dir];
}

export function closeBoundaryHole(graph: PuzzleGraph, cell: Cell, dir: Dir): void {
  graph.holeMask[cell] &= ~BIT[dir];
}

export function hasInternalEdgeOpen(graph: PuzzleGraph, a: Cell, b: Cell): boolean {
  const dir = directionBetween(a, b, graph.w);
  return (graph.adjMask[a] & BIT[dir]) !== 0;
}

export function isSolutionEdge(graph: PuzzleGraph, a: Cell, b: Cell): boolean {
  const dir = directionBetween(a, b, graph.w);
  return (graph.solMask[a] & BIT[dir]) !== 0;
}

export function makeInternalWallCandidates(graph: PuzzleGraph): Candidate[] {
  const candidates: Candidate[] = [];
  for (let cell = 0; cell < graph.n; cell += 1) {
    for (const dir of [Dir.R, Dir.D]) {
      const next = neighborInDir(cell, dir, graph.w, graph.h);
      if (next === -1) continue;
      if (hasInternalEdgeOpen(graph, cell, next)) continue;
      if (isSolutionEdge(graph, cell, next)) continue;
      candidates.push({ kind: 'internal', a: cell, b: next, dirAB: dir });
    }
  }
  return candidates;
}

export function makeBoundaryHoleCandidates(graph: PuzzleGraph, solution: PathState): Candidate[] {
  const candidates: Candidate[] = [];
  const start = solution.path[0];
  const end = solution.path[solution.n - 1];

  for (let cell = 0; cell < graph.n; cell += 1) {
    if (!isBoundaryCell(cell, graph.w, graph.h)) continue;
    if (cell === start || cell === end) continue;
    if (graph.holeMask[cell] !== 0) continue;

    for (const dir of boundaryDirs(cell, graph.w, graph.h)) {
      if ((graph.holeMask[cell] & BIT[dir]) === 0) {
        candidates.push({ kind: 'hole', cell, dir });
      }
    }
  }

  return candidates;
}

export function applyCandidate(graph: PuzzleGraph, candidate: Candidate): void {
  if (candidate.kind === 'internal') openInternalEdge(graph, candidate.a, candidate.b);
  else openBoundaryHole(graph, candidate.cell, candidate.dir);
}

export function undoCandidate(graph: PuzzleGraph, candidate: Candidate): void {
  if (candidate.kind === 'internal') closeInternalEdge(graph, candidate.a, candidate.b);
  else closeBoundaryHole(graph, candidate.cell, candidate.dir);
}

export function carvePuzzle(
  graph: PuzzleGraph,
  solution: PathState,
  mode: HoleMode,
  rng: RNG,
  options: GenerateOptions,
  deadlineAt: number
): { maxRemoved: number; restored: number; timeoutSummary: TimeoutSummary; timings: CarveTimings } {
  const totalStartedAt = now();
  const timings = createCarveTimings();
  const removed: Candidate[] = [];
  const timeoutSummary: TimeoutSummary = { total: 0, internal: 0, hole: 0, examples: [] };

  const runCandidatePhase = (candidates: Candidate[]) => {
    const loopStartedAt = now();
    for (const candidate of candidates) {
      if (now() > deadlineAt) {
        timings.deadlineExceeded = true;
        break;
      }

      if (candidate.kind === 'hole' && graph.holeMask[candidate.cell] !== 0) {
        timings.skippedCandidates += 1;
        continue;
      }

      timings.checkedCandidates += 1;
      let startedAt = now();
      applyCandidate(graph, candidate);
      timings.applyMs += now() - startedAt;

      const verifyTimings = options.profileVerify ? createVerifyTimings() : undefined;
      startedAt = now();
      const result = verifyStillUniqueAfterAddingCandidate(
        graph,
        solution,
        candidate,
        deadlineAt,
        options,
        verifyTimings
      );
      const verifyElapsed = now() - startedAt;
      timings.verifyMs += verifyElapsed;
      if (verifyTimings) {
        addVerifyTimings(timings.verify, verifyTimings);
      } else {
        timings.verify.totalMs += verifyElapsed;
        timings.verify.calls += 1;
      }

      if (result === 'unique') {
        removed.push(candidate);
        timings.acceptedCandidates += 1;
      } else {
        if (result === 'timeout') {
          recordTimeout(timeoutSummary, candidate);
          timings.timeoutCandidates += 1;
          timings.deadlineExceeded = true;
        } else {
          timings.alternativeCandidates += 1;
        }
        startedAt = now();
        undoCandidate(graph, candidate);
        timings.undoMs += now() - startedAt;
        if (result === 'timeout') break;
      }
    }
    timings.candidateLoopMs += now() - loopStartedAt;
  };

  let startedAt = now();
  const internalCandidates = makeInternalWallCandidates(graph);
  timings.internalCandidateMs += now() - startedAt;
  timings.internalCandidateCount = internalCandidates.length;

  if (mode === 'multi-holes') {
    startedAt = now();
    const holeCandidates = makeBoundaryHoleCandidates(graph, solution);
    timings.holeCandidateMs += now() - startedAt;
    timings.holeCandidateCount = holeCandidates.length;
    internalCandidates.push(...holeCandidates);
  }
  timings.candidateCount = internalCandidates.length;

  startedAt = now();
  shuffleInPlace(internalCandidates, rng);
  orderCandidatesForFastRejection(internalCandidates, solution, mode === 'more-holes' ? 'two-holes' : mode);
  timings.candidateShuffleMs += now() - startedAt;

  runCandidatePhase(internalCandidates);

  if (mode === 'more-holes' && !timings.deadlineExceeded) {
    startedAt = now();
    const holeCandidates = makeBoundaryHoleCandidates(graph, solution);
    timings.holeCandidateMs += now() - startedAt;
    timings.holeCandidateCount = holeCandidates.length;
    timings.candidateCount += holeCandidates.length;

    startedAt = now();
    shuffleInPlace(holeCandidates, rng);
    timings.candidateShuffleMs += now() - startedAt;

    runCandidatePhase(holeCandidates);
  }

  const restoreStartedAt = now();
  const restored = Math.min(removed.length, Math.round(removed.length * options.restoreRatio));
  startedAt = now();
  const restoreCandidates = shuffleCopy(removed, rng).slice(0, restored);
  timings.restoreShuffleMs += now() - startedAt;

  for (const candidate of restoreCandidates) {
    startedAt = now();
    undoCandidate(graph, candidate);
    timings.restoreUndoMs += now() - startedAt;
  }
  timings.restoreMs += now() - restoreStartedAt;
  timings.totalMs = now() - totalStartedAt;

  return { maxRemoved: removed.length, restored, timeoutSummary, timings };
}

export function verifyStillUniqueAfterAddingCandidate(
  graph: PuzzleGraph,
  solution: PathState,
  candidate: Candidate,
  deadlineAt: number,
  _options: GenerateOptions,
  timings?: VerifyTimings
): VerifyResult {
  const totalStartedAt = now();
  const finish = (result: VerifyResult): VerifyResult => {
    if (timings) {
      timings.totalMs += now() - totalStartedAt;
      timings.calls += 1;
    }
    return result;
  };

  if (now() > deadlineAt) return finish('timeout');

  const setupStartedAt = timings ? now() : 0;
  const startCells = openHoleCells(graph);
  if (startCells.length === 0) {
    if (timings) timings.setupMs += now() - setupStartedAt;
    return finish(verifyStillUniqueCycleAfterAddingCandidate(graph, solution, candidate, deadlineAt, timings));
  }

  if (startCells.length < 2) {
    if (timings) timings.setupMs += now() - setupStartedAt;
    return finish('unique');
  }

  const searchGraph = buildForcedSearchGraph(graph, candidate);
  if (timings) timings.setupMs += now() - setupStartedAt;

  if (candidate.kind === 'internal') {
    const quickStartedAt = timings ? now() : 0;
    const hasWitness =
      touchesSolutionEndpoint(solution, candidate) || hasTwoOptWitness(graph, solution, candidate);
    if (timings) timings.quickRejectMs += now() - quickStartedAt;
    if (hasWitness) return finish('alternative');
  }

  const endpointStartedAt = timings ? now() : 0;
  const endpointPairs = makeEndpointPairs(startCells, solution, candidate);
  if (timings) timings.endpointPairMs += now() - endpointStartedAt;

  const searchStartedAt = timings ? now() : 0;
  for (const pair of endpointPairs) {
    if (now() > deadlineAt) {
      if (timings) timings.searchMs += now() - searchStartedAt;
      return finish('timeout');
    }

    const result = hasForcedHamiltonianPath(searchGraph, pair.a, pair.b, deadlineAt, timings);
    if (result === 'found') {
      if (timings) timings.searchMs += now() - searchStartedAt;
      return finish('alternative');
    }
    if (result === 'timeout') {
      if (timings) timings.searchMs += now() - searchStartedAt;
      return finish('timeout');
    }
  }

  if (timings) timings.searchMs += now() - searchStartedAt;
  return finish('unique');
}

function verifyStillUniqueCycleAfterAddingCandidate(
  graph: PuzzleGraph,
  solution: PathState,
  candidate: Candidate,
  deadlineAt: number,
  timings?: VerifyTimings
): VerifyResult {
  if (candidate.kind !== 'internal') return 'unique';
  if (now() > deadlineAt) return 'timeout';

  const quickStartedAt = timings ? now() : 0;
  if (hasCycleTwoOptWitness(graph, solution, candidate)) {
    if (timings) timings.quickRejectMs += now() - quickStartedAt;
    return 'alternative';
  }
  if (timings) timings.quickRejectMs += now() - quickStartedAt;

  const setupStartedAt = timings ? now() : 0;
  const searchGraph = buildForcedSearchGraph(graph, candidate, true);
  if (timings) timings.setupMs += now() - setupStartedAt;

  const searchStartedAt = timings ? now() : 0;
  const result = hasForcedHamiltonianPath(searchGraph, candidate.a, candidate.b, deadlineAt, timings);
  if (timings) timings.searchMs += now() - searchStartedAt;

  if (result === 'found') return 'alternative';
  if (result === 'timeout') return 'timeout';
  return 'unique';
}

interface EndpointPair {
  a: Cell;
  b: Cell;
}

interface ForcedSearchGraph {
  n: number;
  edgeU: number[];
  edgeV: number[];
  incident: number[][];
  forcedEdge: number;
}

type ForcedSearchResult = 'found' | 'none' | 'timeout';

function makeEndpointPairs(
  holeCells: Cell[],
  solution: PathState,
  candidate: Candidate
): EndpointPair[] {
  const pairs: EndpointPair[] = [];
  const seen = new Set<string>();
  const addPair = (a: Cell, b: Cell) => {
    if (a === b) return;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}:${hi}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ a: lo, b: hi });
  };

  const holeSet = new Set(holeCells);
  const solutionStart = solution.path[0];
  const solutionEnd = solution.path[solution.n - 1];

  if (candidate.kind === 'hole') {
    const forced = candidate.cell;
    if (holeSet.has(solutionStart)) addPair(forced, solutionStart);
    if (holeSet.has(solutionEnd)) addPair(forced, solutionEnd);
    for (const hole of holeCells) addPair(forced, hole);
    return pairs;
  }

  if (holeSet.has(solutionStart) && holeSet.has(solutionEnd)) {
    addPair(solutionStart, solutionEnd);
  }

  for (let i = 0; i < holeCells.length; i += 1) {
    for (let j = i + 1; j < holeCells.length; j += 1) {
      addPair(holeCells[i], holeCells[j]);
    }
  }

  return pairs;
}

function hasTwoOptWitness(
  graph: PuzzleGraph,
  solution: PathState,
  candidate: Extract<Candidate, { kind: 'internal' }>
) {
  let i = solution.pos[candidate.a];
  let j = solution.pos[candidate.b];
  if (i > j) [i, j] = [j, i];

  if (j + 1 < solution.n) {
    const a = solution.path[i + 1];
    const b = solution.path[j + 1];
    if (areAdjacent(a, b, graph.w) && hasInternalEdgeOpen(graph, a, b)) return true;
  }

  if (i - 1 >= 0) {
    const a = solution.path[i - 1];
    const b = solution.path[j - 1];
    if (areAdjacent(a, b, graph.w) && hasInternalEdgeOpen(graph, a, b)) return true;
  }

  return false;
}

function hasCycleTwoOptWitness(
  graph: PuzzleGraph,
  solution: PathState,
  candidate: Extract<Candidate, { kind: 'internal' }>
) {
  let i = solution.pos[candidate.a];
  let j = solution.pos[candidate.b];
  if (i > j) [i, j] = [j, i];

  const nextI = solution.path[(i + 1) % solution.n];
  const nextJ = solution.path[(j + 1) % solution.n];
  if (areAdjacent(nextI, nextJ, graph.w) && hasInternalEdgeOpen(graph, nextI, nextJ)) return true;

  const prevI = solution.path[(i - 1 + solution.n) % solution.n];
  const prevJ = solution.path[(j - 1 + solution.n) % solution.n];
  if (areAdjacent(prevI, prevJ, graph.w) && hasInternalEdgeOpen(graph, prevI, prevJ)) return true;

  return false;
}

function touchesSolutionEndpoint(
  solution: PathState,
  candidate: Extract<Candidate, { kind: 'internal' }>
) {
  const start = solution.path[0];
  const end = solution.path[solution.n - 1];
  return candidate.a === start || candidate.b === start || candidate.a === end || candidate.b === end;
}

function buildForcedSearchGraph(
  graph: PuzzleGraph,
  candidate: Candidate,
  skipCandidate = false
): ForcedSearchGraph {
  const edgeU: number[] = [];
  const edgeV: number[] = [];
  const incident: number[][] = Array.from({ length: graph.n }, () => []);
  let forcedEdge = -1;

  const addEdge = (a: Cell, b: Cell) => {
    const matchesCandidate =
      candidate.kind === 'internal' &&
      ((candidate.a === a && candidate.b === b) || (candidate.a === b && candidate.b === a));
    if (skipCandidate && matchesCandidate) return;

    const index = edgeU.length;
    edgeU.push(a);
    edgeV.push(b);
    incident[a].push(index);
    incident[b].push(index);
    if (matchesCandidate) {
      forcedEdge = index;
    }
  };

  for (let cell = 0; cell < graph.n; cell += 1) {
    for (const dir of [Dir.R, Dir.D]) {
      if ((graph.adjMask[cell] & BIT[dir]) === 0) continue;
      const next = neighborInDir(cell, dir, graph.w, graph.h);
      if (next !== -1) addEdge(cell, next);
    }
  }

  return { n: graph.n, edgeU, edgeV, incident, forcedEdge };
}

function hasForcedHamiltonianPath(
  searchGraph: ForcedSearchGraph,
  endpointA: Cell,
  endpointB: Cell,
  deadlineAt: number,
  timings?: VerifyTimings
): ForcedSearchResult {
  const resetStartedAt = timings ? now() : 0;
  const search = new DegreePathSearch(searchGraph, endpointA, endpointB, deadlineAt, timings);
  if (timings) {
    timings.resetMs += now() - resetStartedAt;
    timings.startAttempts += 1;
  }
  return search.run();
}

const enum EdgeState {
  Unknown = 0,
  Selected = 1,
  Banned = 2,
}

class DegreePathSearch {
  private readonly state: Int8Array;
  private readonly deg: Int8Array;
  private readonly remain: Int8Array;
  private readonly target: Int8Array;
  private readonly edgeTrail: number[] = [];
  private readonly dirtyVertices: number[] = [];
  private readonly dirtyMark: Uint8Array;
  private readonly reachStack: Int32Array;
  private readonly reachSeen: Int32Array;
  private readonly dsu: RollbackDsu;
  private selectedEdges = 0;
  private searchSteps = 0;
  private reachStamp = 0;
  private timedOut = false;

  constructor(
    private readonly graph: ForcedSearchGraph,
    endpointA: Cell,
    endpointB: Cell,
    private readonly deadlineAt: number,
    private readonly timings?: VerifyTimings
  ) {
    this.state = new Int8Array(graph.edgeU.length);
    this.deg = new Int8Array(graph.n);
    this.remain = new Int8Array(graph.n);
    this.target = new Int8Array(graph.n);
    this.dirtyMark = new Uint8Array(graph.n);
    this.reachStack = new Int32Array(graph.n);
    this.reachSeen = new Int32Array(graph.n);
    this.target.fill(2);
    this.target[endpointA] = 1;
    this.target[endpointB] = 1;
    this.dsu = new RollbackDsu(graph.n);

    for (let cell = 0; cell < graph.n; cell += 1) {
      this.remain[cell] = graph.incident[cell].length;
      this.markDirty(cell);
    }
  }

  run(): ForcedSearchResult {
    const snapshot = this.snapshot();
    let ok = true;
    if (this.graph.forcedEdge !== -1) ok = this.forceSelect(this.graph.forcedEdge);
    if (ok) ok = this.dfs();
    this.rollback(snapshot);
    if (this.timedOut) return 'timeout';
    return ok ? 'found' : 'none';
  }

  private dfs(): boolean {
    this.searchSteps += 1;
    if (this.timings) this.timings.searchSteps += 1;
    if ((this.searchSteps & 511) === 0) {
      if (now() > this.deadlineAt) {
        this.timedOut = true;
        return false;
      }
    }

    if (!this.propagate()) return false;
    if (this.selectedEdges > this.graph.n - 1) return false;

    if (this.selectedEdges === this.graph.n - 1) {
      if (this.timings) this.timings.terminalChecks += 1;
      return true;
    }
    if ((this.searchSteps & 127) === 0 && !this.availableGraphConnected()) return false;

    const branchStartedAt = this.timings ? now() : 0;
    const branchVertex = this.chooseBranchVertex();
    if (this.timings) this.timings.branchMs += now() - branchStartedAt;
    if (branchVertex === -1) return false;

    const unknownEdges = this.collectUnknownIncident(branchVertex);
    const need = this.target[branchVertex] - this.deg[branchVertex];
    const limit = 1 << unknownEdges.length;

    for (let mask = 0; mask < limit; mask += 1) {
      if (bitCount(mask) !== need) continue;
      const snapshot = this.snapshot();
      let ok = true;

      for (let i = 0; i < unknownEdges.length && ok; i += 1) {
        ok = (mask & (1 << i)) !== 0
          ? this.forceSelect(unknownEdges[i])
          : this.forceBan(unknownEdges[i]);
      }

      if (ok && this.dfs()) return true;
      this.rollback(snapshot);
      if (this.timedOut) return false;
    }

    return false;
  }

  private propagate(): boolean {
    const startedAt = this.timings ? now() : 0;

    while (this.dirtyVertices.length > 0) {
      const cell = this.dirtyVertices.pop() as number;
      this.dirtyMark[cell] = 0;

      for (const edge of this.graph.incident[cell]) {
        if (this.state[edge] !== EdgeState.Unknown) continue;
        if (!this.dsu.connected(this.graph.edgeU[edge], this.graph.edgeV[edge])) continue;
        if (!this.forceBan(edge)) {
          if (this.timings) this.timings.propagateMs += now() - startedAt;
          return false;
        }
      }

      const need = this.target[cell] - this.deg[cell];
      if (need < 0 || need > this.remain[cell]) {
        if (this.timings) this.timings.propagateMs += now() - startedAt;
        return false;
      }

      if (need !== 0 && need !== this.remain[cell]) continue;

      for (const edge of this.graph.incident[cell]) {
        if (this.state[edge] !== EdgeState.Unknown) continue;
        const ok = need === 0 ? this.forceBan(edge) : this.forceSelect(edge);
        if (!ok) {
          if (this.timings) this.timings.propagateMs += now() - startedAt;
          return false;
        }
      }
    }

    if (this.timings) this.timings.propagateMs += now() - startedAt;
    return true;
  }

  private chooseBranchVertex() {
    let bestVertex = -1;
    let bestCombinations = Number.POSITIVE_INFINITY;
    let bestRemain = Number.POSITIVE_INFINITY;

    for (let cell = 0; cell < this.graph.n; cell += 1) {
      const need = this.target[cell] - this.deg[cell];
      if (need <= 0) continue;
      const remaining = this.remain[cell];
      if (need > remaining) return cell;
      if (need === remaining) return cell;

      const combinations = chooseSmall(remaining, need);
      if (combinations < bestCombinations || (combinations === bestCombinations && remaining < bestRemain)) {
        bestVertex = cell;
        bestCombinations = combinations;
        bestRemain = remaining;
      }
    }

    return bestVertex;
  }

  private collectUnknownIncident(cell: Cell) {
    const edges: number[] = [];
    for (const edge of this.graph.incident[cell]) {
      if (this.state[edge] === EdgeState.Unknown) edges.push(edge);
    }
    return edges;
  }

  private forceSelect(edge: number) {
    const state = this.state[edge];
    if (state === EdgeState.Selected) return true;
    if (state === EdgeState.Banned) return false;

    const a = this.graph.edgeU[edge];
    const b = this.graph.edgeV[edge];
    if (this.deg[a] >= this.target[a] || this.deg[b] >= this.target[b]) return false;
    if (!this.dsu.union(a, b)) return false;

    this.state[edge] = EdgeState.Selected;
    this.edgeTrail.push(edge);
    this.remain[a] -= 1;
    this.remain[b] -= 1;
    this.deg[a] += 1;
    this.deg[b] += 1;
    this.selectedEdges += 1;
    this.markDirty(a);
    this.markDirty(b);
    return true;
  }

  private forceBan(edge: number) {
    const state = this.state[edge];
    if (state === EdgeState.Banned) return true;
    if (state === EdgeState.Selected) return false;

    const a = this.graph.edgeU[edge];
    const b = this.graph.edgeV[edge];
    this.state[edge] = EdgeState.Banned;
    this.edgeTrail.push(edge);
    this.remain[a] -= 1;
    this.remain[b] -= 1;
    this.markDirty(a);
    this.markDirty(b);
    return true;
  }

  private snapshot(): SearchSnapshot {
    return {
      trailLength: this.edgeTrail.length,
      dsuLength: this.dsu.snapshot(),
      selectedEdges: this.selectedEdges,
      dirtyLength: this.dirtyVertices.length,
    };
  }

  private rollback(snapshot: SearchSnapshot) {
    while (this.dirtyVertices.length > snapshot.dirtyLength) {
      const cell = this.dirtyVertices.pop() as number;
      this.dirtyMark[cell] = 0;
    }

    while (this.edgeTrail.length > snapshot.trailLength) {
      const edge = this.edgeTrail.pop() as number;
      const state = this.state[edge];
      const a = this.graph.edgeU[edge];
      const b = this.graph.edgeV[edge];
      this.state[edge] = EdgeState.Unknown;
      this.remain[a] += 1;
      this.remain[b] += 1;
      if (state === EdgeState.Selected) {
        this.deg[a] -= 1;
        this.deg[b] -= 1;
      }
    }
    this.selectedEdges = snapshot.selectedEdges;
    this.dsu.rollback(snapshot.dsuLength);
  }

  private markDirty(cell: Cell) {
    if (this.dirtyMark[cell] === 1) return;
    this.dirtyMark[cell] = 1;
    this.dirtyVertices.push(cell);
  }

  private availableGraphConnected() {
    const startedAt = this.timings ? now() : 0;
    this.reachStamp += 1;
    let head = 0;
    let tail = 0;
    let seenCount = 1;
    this.reachStack[tail] = 0;
    tail += 1;
    this.reachSeen[0] = this.reachStamp;

    while (head < tail) {
      const cell = this.reachStack[head];
      head += 1;

      for (const edge of this.graph.incident[cell]) {
        if (this.state[edge] === EdgeState.Banned) continue;
        const next = this.graph.edgeU[edge] === cell ? this.graph.edgeV[edge] : this.graph.edgeU[edge];
        if (this.reachSeen[next] === this.reachStamp) continue;
        this.reachSeen[next] = this.reachStamp;
        this.reachStack[tail] = next;
        tail += 1;
        seenCount += 1;
      }
    }

    if (this.timings) this.timings.connectivityPruneMs += now() - startedAt;
    return seenCount === this.graph.n;
  }
}

interface SearchSnapshot {
  trailLength: number;
  dsuLength: number;
  selectedEdges: number;
  dirtyLength: number;
}

class RollbackDsu {
  private readonly parent: Int32Array;
  private readonly size: Int32Array;
  private readonly childStack: number[] = [];
  private readonly parentStack: number[] = [];
  private readonly sizeStack: number[] = [];

  constructor(n: number) {
    this.parent = new Int32Array(n);
    this.size = new Int32Array(n);
    for (let i = 0; i < n; i += 1) {
      this.parent[i] = i;
      this.size[i] = 1;
    }
  }

  snapshot() {
    return this.childStack.length;
  }

  rollback(snapshot: number) {
    while (this.childStack.length > snapshot) {
      const child = this.childStack.pop() as number;
      const parent = this.parentStack.pop() as number;
      const oldSize = this.sizeStack.pop() as number;
      this.parent[child] = child;
      this.size[parent] = oldSize;
    }
  }

  union(a: number, b: number) {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return false;

    if (this.size[rootA] < this.size[rootB]) {
      [rootA, rootB] = [rootB, rootA];
    }

    this.childStack.push(rootB);
    this.parentStack.push(rootA);
    this.sizeStack.push(this.size[rootA]);
    this.parent[rootB] = rootA;
    this.size[rootA] += this.size[rootB];
    return true;
  }

  connected(a: number, b: number) {
    return this.find(a) === this.find(b);
  }

  private find(cell: number) {
    while (this.parent[cell] !== cell) cell = this.parent[cell];
    return cell;
  }
}

function bitCount(value: number) {
  let count = 0;
  while (value !== 0) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

function chooseSmall(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (n === 4 && (k === 1 || k === 3)) return 4;
  if (n === 4 && k === 2) return 6;
  if (n === 3 && (k === 1 || k === 2)) return 3;
  return n;
}

export function generatePuzzle(
  w: number,
  h: number,
  mode: HoleMode,
  rng: RNG,
  options: GenerateOptionsInput = {},
  seed = 0
): GeneratedPuzzle {
  if (w < 2 || h < 2 || w * h < 4) {
    throw new Error('Alcazar puzzle must be at least 2x2 and contain 4 cells.');
  }

  const totalStartedAt = now();
  let startedAt = now();
  const fullOptions = withDefaultOptions(w, h, options);
  const optionsMs = now() - startedAt;
  const deadlineAt = totalStartedAt + fullOptions.totalDeadlineMs;

  startedAt = now();
  const solution = mode === 'one-cycle'
    ? generateSolutionCycle(w, h, rng, fullOptions)
    : generateSolutionPath(w, h, rng, fullOptions);
  const solutionMs = now() - startedAt;

  startedAt = now();
  const graph = mode === 'one-cycle'
    ? buildInitialCyclePuzzle(solution)
    : buildInitialPuzzle(solution, rng);
  const initialPuzzleMs = now() - startedAt;

  startedAt = now();
  const carved = carvePuzzle(graph, solution, mode, rng, fullOptions, deadlineAt);
  const carveMs = now() - startedAt;
  const totalMs = now() - totalStartedAt;

  return {
    graph,
    solution,
    mode,
    maxRemovedWalls: carved.maxRemoved,
    restoredWalls: carved.restored,
    timedOutCandidates: carved.timeoutSummary.total,
    timeoutSummary: carved.timeoutSummary,
    timings: {
      totalMs,
      optionsMs,
      solutionMs,
      initialPuzzleMs,
      carveMs,
      carve: carved.timings,
    },
    deadlineExceeded: carved.timings.deadlineExceeded,
    seed,
  };
}

export function countOpenHoles(graph: PuzzleGraph) {
  let count = 0;
  for (let cell = 0; cell < graph.n; cell += 1) {
    for (let dir = 0; dir < 4; dir += 1) {
      if ((graph.holeMask[cell] & BIT[dir]) !== 0) count += 1;
    }
  }
  return count;
}

export function countClosedWalls(graph: PuzzleGraph) {
  let walls = 0;
  for (let cell = 0; cell < graph.n; cell += 1) {
    for (const dir of [Dir.R, Dir.D]) {
      const next = neighborInDir(cell, dir, graph.w, graph.h);
      if (next !== -1 && (graph.adjMask[cell] & BIT[dir]) === 0) walls += 1;
    }
    for (const dir of boundaryDirs(cell, graph.w, graph.h)) {
      if ((graph.holeMask[cell] & BIT[dir]) === 0) walls += 1;
    }
  }
  return walls;
}

function withDefaultOptions(_w: number, _h: number, options: GenerateOptionsInput): GenerateOptions {
  return {
    solutionDeadlineMs: options.solutionDeadlineMs ?? 120,
    totalDeadlineMs: options.totalDeadlineMs ?? 10_000,
    minBackbiteFactor: options.minBackbiteFactor ?? 80,
    maxBackbiteFactor: options.maxBackbiteFactor ?? 500,
    restoreRatio: Math.max(0, Math.min(1, options.restoreRatio ?? 0)),
    profileVerify: options.profileVerify ?? false,
    verificationShortcuts: {
      ...DEFAULT_VERIFICATION_SHORTCUTS,
      ...options.verificationShortcuts,
    },
  };
}

function openHoleCells(graph: PuzzleGraph) {
  const cells: number[] = [];
  for (let cell = 0; cell < graph.n; cell += 1) {
    if (graph.holeMask[cell] !== 0) cells.push(cell);
  }
  return cells;
}

function shuffleInPlace<T>(items: T[], rng: RNG): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function shuffleCopy<T>(items: T[], rng: RNG): T[] {
  const copy = [...items];
  shuffleInPlace(copy, rng);
  return copy;
}

function orderCandidatesForFastRejection(
  candidates: Candidate[],
  solution: PathState,
  mode: HoleMode
): void {
  if (mode === 'two-holes') {
    candidates.sort((a, b) => twoHoleCandidatePriority(a, solution) - twoHoleCandidatePriority(b, solution));
    return;
  }

  if (mode === 'one-cycle') {
    candidates.sort((a, b) => oneCycleCandidatePriority(a, solution) - oneCycleCandidatePriority(b, solution));
    return;
  }

  candidates.sort((a, b) => multiHoleCandidatePriority(a, solution) - multiHoleCandidatePriority(b, solution));
}

function twoHoleCandidatePriority(candidate: Candidate, solution: PathState) {
  if (candidate.kind === 'hole') return 2_000_000;

  const endpointBoost = touchesSolutionEndpoint(solution, candidate) ? -1_000_000 : 0;
  const pathDistance = Math.abs(solution.pos[candidate.a] - solution.pos[candidate.b]);
  return endpointBoost + pathDistance;
}

function multiHoleCandidatePriority(candidate: Candidate, solution: PathState) {
  if (solution.n < 400) {
    if (candidate.kind === 'hole') return -1;

    const endpointBoost = touchesSolutionEndpoint(solution, candidate) ? 1_000_000 : 0;
    const pathDistance = Math.abs(solution.pos[candidate.a] - solution.pos[candidate.b]);
    return -(endpointBoost + pathDistance);
  }

  if (candidate.kind === 'hole') return 2_000_000;

  const endpointBoost = touchesSolutionEndpoint(solution, candidate) ? -1_000_000 : 0;
  const pathDistance = Math.abs(solution.pos[candidate.a] - solution.pos[candidate.b]);
  return endpointBoost + Math.abs(pathDistance - 16) * 1000 - pathDistance;
}

function oneCycleCandidatePriority(candidate: Candidate, solution: PathState) {
  if (candidate.kind === 'hole') return 2_000_000;

  const distance = Math.abs(solution.pos[candidate.a] - solution.pos[candidate.b]);
  return Math.min(distance, solution.n - distance);
}

function pick<T>(rng: RNG, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomInt(rng: RNG, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function now() {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function createCarveTimings(): CarveTimings {
  return {
    totalMs: 0,
    internalCandidateMs: 0,
    holeCandidateMs: 0,
    candidateShuffleMs: 0,
    candidateLoopMs: 0,
    applyMs: 0,
    verifyMs: 0,
    undoMs: 0,
    restoreMs: 0,
    restoreShuffleMs: 0,
    restoreUndoMs: 0,
    candidateCount: 0,
    internalCandidateCount: 0,
    holeCandidateCount: 0,
    checkedCandidates: 0,
    skippedCandidates: 0,
    acceptedCandidates: 0,
    alternativeCandidates: 0,
    timeoutCandidates: 0,
    deadlineExceeded: false,
    verify: createVerifyTimings(),
  };
}

function createVerifyTimings(): VerifyTimings {
  return {
    totalMs: 0,
    setupMs: 0,
    searchMs: 0,
    resetMs: 0,
    quickRejectMs: 0,
    endpointPairMs: 0,
    propagateMs: 0,
    branchMs: 0,
    prepareChoicesMs: 0,
    candidateUsagePruneMs: 0,
    degreeFeasibilityPruneMs: 0,
    connectivityPruneMs: 0,
    parityPruneMs: 0,
    forcedMovePruneMs: 0,
    advanceMs: 0,
    backtrackMs: 0,
    terminalMs: 0,
    calls: 0,
    startAttempts: 0,
    searchSteps: 0,
    terminalChecks: 0,
  };
}

function addVerifyTimings(target: VerifyTimings, source: VerifyTimings): void {
  target.totalMs += source.totalMs;
  target.setupMs += source.setupMs;
  target.searchMs += source.searchMs;
  target.resetMs += source.resetMs;
  target.quickRejectMs += source.quickRejectMs;
  target.endpointPairMs += source.endpointPairMs;
  target.propagateMs += source.propagateMs;
  target.branchMs += source.branchMs;
  target.prepareChoicesMs += source.prepareChoicesMs;
  target.candidateUsagePruneMs += source.candidateUsagePruneMs;
  target.degreeFeasibilityPruneMs += source.degreeFeasibilityPruneMs;
  target.connectivityPruneMs += source.connectivityPruneMs;
  target.parityPruneMs += source.parityPruneMs;
  target.forcedMovePruneMs += source.forcedMovePruneMs;
  target.advanceMs += source.advanceMs;
  target.backtrackMs += source.backtrackMs;
  target.terminalMs += source.terminalMs;
  target.calls += source.calls;
  target.startAttempts += source.startAttempts;
  target.searchSteps += source.searchSteps;
  target.terminalChecks += source.terminalChecks;
}

function prepareChoices(
  graph: PuzzleGraph,
  visited: Uint8Array,
  current: Cell,
  depth: number,
  candidate: Candidate,
  usedCandidate: boolean,
  shortcuts: VerificationShortcuts,
  stackChoices: Int8Array,
  stackChoiceCount: Uint8Array,
  stackChoiceIndex: Uint8Array
) {
  const needsRemaining = shortcuts.forcedCandidateNext || shortcuts.forcedTightCell;
  const remaining = needsRemaining ? graph.n - countVisited(visited) : 0;

  if (shortcuts.forcedCandidateNext) {
    const forcedByCandidate = forcedCandidateNext(
      graph,
      visited,
      current,
      candidate,
      usedCandidate,
      remaining
    );
    if (forcedByCandidate !== -1) {
      stackChoiceIndex[depth] = 0;
      if (forcedByCandidate === -2) {
        stackChoiceCount[depth] = 0;
        return;
      }
      stackChoiceCount[depth] = 1;
      stackChoices[depth * 4] = directionBetween(current, forcedByCandidate, graph.w);
      return;
    }
  }

  if (shortcuts.forcedTightCell) {
    const forcedByTightCell = forcedNextFromTightCells(graph, visited, current, remaining);
    if (forcedByTightCell !== -1) {
      stackChoiceIndex[depth] = 0;
      if (forcedByTightCell === -2) {
        stackChoiceCount[depth] = 0;
        return;
      }
      stackChoiceCount[depth] = 1;
      stackChoices[depth * 4] = directionBetween(current, forcedByTightCell, graph.w);
      return;
    }
  }

  const choices: Array<{ dir: Dir; score: number }> = [];
  for (let dir = 0; dir < 4; dir += 1) {
    if ((graph.adjMask[current] & BIT[dir]) === 0) continue;
    const next = neighborInDir(current, dir as Dir, graph.w, graph.h);
    if (next === -1 || visited[next] === 1) continue;

    const usesCandidate =
      shortcuts.choiceOrdering &&
      !usedCandidate &&
      candidate.kind === 'internal' &&
      ((current === candidate.a && next === candidate.b) ||
        (current === candidate.b && next === candidate.a));
    choices.push({
      dir: dir as Dir,
      score: shortcuts.choiceOrdering
        ? (usesCandidate ? -100 : 0) + onwardCount(graph, visited, next, current)
        : choices.length,
    });
  }

  if (shortcuts.choiceOrdering) choices.sort((a, b) => a.score - b.score);
  stackChoiceCount[depth] = choices.length;
  stackChoiceIndex[depth] = 0;
  for (let i = 0; i < choices.length; i += 1) {
    stackChoices[depth * 4 + i] = choices[i].dir;
  }
}

function onwardCount(graph: PuzzleGraph, visited: Uint8Array, cell: Cell, previous: Cell) {
  let count = 0;
  for (let dir = 0; dir < 4; dir += 1) {
    if ((graph.adjMask[cell] & BIT[dir]) === 0) continue;
    const next = neighborInDir(cell, dir as Dir, graph.w, graph.h);
    if (next !== -1 && next !== previous && visited[next] === 0) count += 1;
  }
  return count;
}

function candidateUsagePrune(
  candidate: Candidate,
  visited: Uint8Array,
  current: Cell,
  start: Cell,
  usedCandidate: boolean
) {
  if (usedCandidate) return false;

  if (candidate.kind === 'internal') {
    const aVisited = visited[candidate.a] === 1;
    const bVisited = visited[candidate.b] === 1;
    if (aVisited && bVisited) return true;
    if (aVisited && current !== candidate.a) return true;
    if (bVisited && current !== candidate.b) return true;
    return false;
  }

  if (start === candidate.cell) return false;
  return visited[candidate.cell] === 1 && current !== candidate.cell;
}

function forcedCandidateNext(
  graph: PuzzleGraph,
  visited: Uint8Array,
  current: Cell,
  candidate: Candidate,
  usedCandidate: boolean,
  remaining: number
) {
  if (usedCandidate) return -1;

  if (candidate.kind === 'internal') {
    if (current !== candidate.a && current !== candidate.b) return -1;
    const next = current === candidate.a ? candidate.b : candidate.a;
    return visited[next] === 0 && hasInternalEdgeOpen(graph, current, next) ? next : -2;
  }

  if (current !== candidate.cell) return -1;
  return remaining === 0 ? -1 : -2;
}

function connectivityPrune(
  graph: PuzzleGraph,
  visited: Uint8Array,
  current: Cell,
  visitedCount: number,
  scratch: Int32Array
) {
  const remaining = graph.n - visitedCount;
  if (remaining === 0) return false;

  let head = 0;
  let tail = 0;
  let reachableUnvisited = 0;
  const seen = new Uint8Array(graph.n);
  scratch[tail] = current;
  tail += 1;
  seen[current] = 1;

  while (head < tail) {
    const cell = scratch[head];
    head += 1;
    for (let dir = 0; dir < 4; dir += 1) {
      if ((graph.adjMask[cell] & BIT[dir]) === 0) continue;
      const next = neighborInDir(cell, dir as Dir, graph.w, graph.h);
      if (next === -1 || seen[next] === 1) continue;
      if (visited[next] === 1 && next !== current) continue;
      seen[next] = 1;
      scratch[tail] = next;
      tail += 1;
      if (visited[next] === 0) reachableUnvisited += 1;
    }
  }

  return reachableUnvisited !== remaining;
}

function degreeFeasibilityPrune(
  graph: PuzzleGraph,
  visited: Uint8Array,
  current: Cell,
  visitedCount: number
) {
  let forcedFinalEndpoints = 0;
  const remaining = graph.n - visitedCount;

  for (let cell = 0; cell < graph.n; cell += 1) {
    if (visited[cell] === 1) continue;

    let possibleInternal = 0;
    let onlyNeighbor = -1;
    for (let dir = 0; dir < 4; dir += 1) {
      if ((graph.adjMask[cell] & BIT[dir]) === 0) continue;
      const next = neighborInDir(cell, dir as Dir, graph.w, graph.h);
      if (next !== -1 && (visited[next] === 0 || next === current)) {
        possibleInternal += 1;
        onlyNeighbor = next;
      }
    }

    if (possibleInternal === 0) return true;
    if (possibleInternal < 2) {
      if (graph.holeMask[cell] === 0) return true;
      if (onlyNeighbor === current && remaining > 1) return true;
      forcedFinalEndpoints += 1;
      if (forcedFinalEndpoints > 1) return true;
    }
  }

  return false;
}

function forcedNextFromTightCells(
  graph: PuzzleGraph,
  visited: Uint8Array,
  current: Cell,
  remaining: number
) {
  let forcedNext = -1;

  for (let cell = 0; cell < graph.n; cell += 1) {
    if (visited[cell] === 1) continue;

    const possible: number[] = [];
    for (let dir = 0; dir < 4; dir += 1) {
      if ((graph.adjMask[cell] & BIT[dir]) === 0) continue;
      const next = neighborInDir(cell, dir as Dir, graph.w, graph.h);
      if (next !== -1 && (visited[next] === 0 || next === current)) possible.push(next);
    }

    if (!possible.includes(current)) continue;

    if (graph.holeMask[cell] !== 0 && possible.length === 1) {
      if (remaining === 1) return cell;
      return -2;
    }

    if (graph.holeMask[cell] === 0 && possible.length === 2) {
      if (forcedNext !== -1 && forcedNext !== cell) return -2;
      forcedNext = cell;
    }
  }

  return forcedNext;
}

function countVisited(visited: Uint8Array) {
  let count = 0;
  for (let i = 0; i < visited.length; i += 1) {
    if (visited[i] === 1) count += 1;
  }
  return count;
}

function parityPrune() {
  return false;
}

function forcedMovePrune() {
  return false;
}

function recordTimeout(summary: TimeoutSummary, candidate: Candidate) {
  summary.total += 1;
  if (candidate.kind === 'internal') summary.internal += 1;
  else summary.hole += 1;

  if (summary.examples.length >= 5) return;
  summary.examples.push(
    candidate.kind === 'internal'
      ? `internal:${candidate.a}-${candidate.b}`
      : `hole:${candidate.cell}:${candidate.dir}`
  );
}
