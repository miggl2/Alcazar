import {
  type GenerateOptionsInput,
  type HoleMode,
  type VerificationShortcuts,
  countClosedWalls,
  countOpenHoles,
  createSeededRng,
  generatePuzzle,
} from './alcazar-generator';

interface BenchCase {
  name: string;
  w: number;
  h: number;
  mode: HoleMode;
  runs: number;
  seedStart: number;
  options?: GenerateOptionsInput;
}

interface BenchResult {
  caseName: string;
  seed: number;
  deadlineExceeded: number;
  timeMs: number;
  genTotalMs: number;
  optionsMs: number;
  solutionMs: number;
  initialPuzzleMs: number;
  carveMs: number;
  candidateBuildMs: number;
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
  candidates: number;
  internalCandidates: number;
  holeCandidates: number;
  checkedCandidates: number;
  skippedCandidates: number;
  acceptedCandidates: number;
  alternativeCandidates: number;
  removed: number;
  restored: number;
  finalRemoved: number;
  closedWalls: number;
  holes: number;
  timeoutTotal: number;
  timeoutInternal: number;
  timeoutHole: number;
  verifyCalls: number;
  verifyTotalMs: number;
  verifySetupMs: number;
  verifySearchMs: number;
  verifyResetMs: number;
  verifyQuickRejectMs: number;
  verifyEndpointPairMs: number;
  verifyPropagateMs: number;
  verifyBranchMs: number;
  verifyPrepareChoicesMs: number;
  verifyCandidateUsagePruneMs: number;
  verifyDegreeFeasibilityPruneMs: number;
  verifyConnectivityPruneMs: number;
  verifyParityPruneMs: number;
  verifyForcedMovePruneMs: number;
  verifyAdvanceMs: number;
  verifyBacktrackMs: number;
  verifyTerminalMs: number;
  verifyStartAttempts: number;
  verifySearchSteps: number;
  verifyTerminalChecks: number;
}

const profiles: Record<string, BenchCase[]> = {
  smoke: [
    makeCase('4x4 two', 4, 4, 'two-holes', 3),
    makeCase('6x6 two', 6, 6, 'two-holes', 3),
    makeCase('10x10 multi', 10, 10, 'multi-holes', 2),
  ],
  medium: [
    makeCase('4x4 two', 4, 4, 'two-holes', 10),
    makeCase('6x6 two', 6, 6, 'two-holes', 10),
    makeCase('10x10 two', 10, 10, 'two-holes', 5),
    makeCase('10x10 multi', 10, 10, 'multi-holes', 5),
    makeCase('16x16 two', 16, 16, 'two-holes', 2),
  ],
  large: [
    makeCase('20x20 two', 20, 20, 'two-holes', 2),
    makeCase('20x20 multi', 20, 20, 'multi-holes', 1),
    makeCase('30x30 two', 30, 30, 'two-holes', 1, {
      solutionDeadlineMs: 250,
      totalDeadlineMs: 10_000,
    }),
  ],
};

const shortcutNames = [
  'candidateUsagePrune',
  'forcedCandidateNext',
  'forcedTightCell',
  'degreeFeasibilityPrune',
  'connectivityPrune',
  'parityPrune',
  'forcedMovePrune',
  'choiceOrdering',
] as const;

function makeCase(
  name: string,
  w: number,
  h: number,
  mode: HoleMode,
  runs: number,
  options: GenerateOptionsInput = {}
): BenchCase {
  return { name, w, h, mode, runs, seedStart: 912_000 + w * 100 + h, options };
}

function main() {
  if (hasFlag('--square-scan')) {
    runSquareScan();
    return;
  }

  const profileName = readArg('--profile') ?? 'smoke';
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown profile "${profileName}". Use one of: ${Object.keys(profiles).join(', ')}`);
  }

  const repeat = Number(readArg('--repeat') ?? '1');
  const verifyProfile = hasFlag('--verify-profile');
  const summaryOnly = hasFlag('--summary-only');
  const verificationShortcuts = readShortcutOptions();
  const results: BenchResult[] = [];
  console.log(
    `profile=${profileName} repeat=${repeat} verifyProfile=${
      verifyProfile ? 1 : 0
    } shortcuts=${formatShortcuts(verificationShortcuts)}`
  );
  if (!summaryOnly) console.log(csvHeader().join(','));

  for (let loop = 0; loop < repeat; loop += 1) {
    for (const bench of profile) {
      for (let run = 0; run < bench.runs; run += 1) {
        const seed = bench.seedStart + loop * 10_000 + run;
        const result = runCase(bench, seed, verifyProfile, verificationShortcuts);
        results.push(result);
        if (!summaryOnly) console.log(csvRow(result).join(','));
      }
    }
  }

  console.log('\nsummary');
  for (const caseName of unique(results.map((result) => result.caseName))) {
    const group = results.filter((result) => result.caseName === caseName);
    console.log(formatSummary(caseName, group));
  }
}

function runSquareScan() {
  const mode = readHoleMode();
  const start = Number(readArg('--start') ?? '4');
  const max = Number(readArg('--max') ?? '30');
  const runs = Number(readArg('--runs') ?? '10');
  const totalDeadlineMs = Number(readArg('--total-deadline-ms') ?? '10000');
  const verifyProfile = hasFlag('--verify-profile');
  const summaryOnly = hasFlag('--summary-only');
  const verificationShortcuts = readShortcutOptions();

  console.log(
    `profile=square-scan mode=${mode} start=${start} max=${max} runs=${runs} totalDeadlineMs=${totalDeadlineMs} verifyProfile=${
      verifyProfile ? 1 : 0
    } shortcuts=${formatShortcuts(verificationShortcuts)}`
  );
  if (!summaryOnly) console.log(csvHeader().join(','));

  let bestN = start - 1;
  for (let n = start; n <= max; n += 1) {
    if (mode === 'one-cycle' && (n * n) % 2 !== 0) {
      console.log('square-summary n=' + n + ' skipped=hamiltonian-cycle-requires-even-cell-count');
      continue;
    }

    const bench = makeCase(`${n}x${n} ${mode}`, n, n, mode, runs, { totalDeadlineMs });
    const group: BenchResult[] = [];

    for (let run = 0; run < runs; run += 1) {
      const seed = bench.seedStart + run;
      const result = runCase(bench, seed, verifyProfile, verificationShortcuts);
      group.push(result);
      if (!summaryOnly) console.log(csvRow(result).join(','));
    }

    const deadlineStops = group.reduce((sum, result) => sum + result.deadlineExceeded, 0);
    const avgTimeMs = avg(group, 'timeMs');
    console.log(
      `square-summary n=${n} runs=${runs} avg=${avgTimeMs.toFixed(1)}ms p95=${p95(group, 'timeMs').toFixed(
        1
      )}ms deadlineStops=${deadlineStops} removedAvg=${avg(group, 'finalRemoved').toFixed(
        1
      )}`
    );

    if (deadlineStops > 0 || avgTimeMs >= totalDeadlineMs) {
      console.log(`highest-passed=${bestN}x${bestN}`);
      return;
    }

    bestN = n;
  }

  console.log(`highest-passed=${bestN}x${bestN}`);
}

function runCase(
  bench: BenchCase,
  seed: number,
  verifyProfile: boolean,
  verificationShortcuts: Partial<VerificationShortcuts>
): BenchResult {
  const startedAt = performance.now();
  const options: GenerateOptionsInput = {
    restoreRatio: 0,
    ...bench.options,
    profileVerify: verifyProfile,
    verificationShortcuts: {
      ...bench.options?.verificationShortcuts,
      ...verificationShortcuts,
    },
  };
  const puzzle = generatePuzzle(
    bench.w,
    bench.h,
    bench.mode,
    createSeededRng(seed),
    options,
    seed
  );
  const timeMs = performance.now() - startedAt;
  const { timings } = puzzle;
  const { carve } = timings;
  const { verify } = carve;

  return {
    caseName: bench.name,
    seed,
    deadlineExceeded: puzzle.deadlineExceeded ? 1 : 0,
    timeMs,
    genTotalMs: timings.totalMs,
    optionsMs: timings.optionsMs,
    solutionMs: timings.solutionMs,
    initialPuzzleMs: timings.initialPuzzleMs,
    carveMs: timings.carveMs,
    candidateBuildMs: carve.internalCandidateMs + carve.holeCandidateMs,
    internalCandidateMs: carve.internalCandidateMs,
    holeCandidateMs: carve.holeCandidateMs,
    candidateShuffleMs: carve.candidateShuffleMs,
    candidateLoopMs: carve.candidateLoopMs,
    applyMs: carve.applyMs,
    verifyMs: carve.verifyMs,
    undoMs: carve.undoMs,
    restoreMs: carve.restoreMs,
    restoreShuffleMs: carve.restoreShuffleMs,
    restoreUndoMs: carve.restoreUndoMs,
    candidates: carve.candidateCount,
    internalCandidates: carve.internalCandidateCount,
    holeCandidates: carve.holeCandidateCount,
    checkedCandidates: carve.checkedCandidates,
    skippedCandidates: carve.skippedCandidates,
    acceptedCandidates: carve.acceptedCandidates,
    alternativeCandidates: carve.alternativeCandidates,
    removed: puzzle.maxRemovedWalls,
    restored: puzzle.restoredWalls,
    finalRemoved: puzzle.maxRemovedWalls - puzzle.restoredWalls,
    closedWalls: countClosedWalls(puzzle.graph),
    holes: countOpenHoles(puzzle.graph),
    timeoutTotal: puzzle.timeoutSummary.total,
    timeoutInternal: puzzle.timeoutSummary.internal,
    timeoutHole: puzzle.timeoutSummary.hole,
    verifyCalls: verify.calls,
    verifyTotalMs: verify.totalMs,
    verifySetupMs: verify.setupMs,
    verifySearchMs: verify.searchMs,
    verifyResetMs: verify.resetMs,
    verifyQuickRejectMs: verify.quickRejectMs,
    verifyEndpointPairMs: verify.endpointPairMs,
    verifyPropagateMs: verify.propagateMs,
    verifyBranchMs: verify.branchMs,
    verifyPrepareChoicesMs: verify.prepareChoicesMs,
    verifyCandidateUsagePruneMs: verify.candidateUsagePruneMs,
    verifyDegreeFeasibilityPruneMs: verify.degreeFeasibilityPruneMs,
    verifyConnectivityPruneMs: verify.connectivityPruneMs,
    verifyParityPruneMs: verify.parityPruneMs,
    verifyForcedMovePruneMs: verify.forcedMovePruneMs,
    verifyAdvanceMs: verify.advanceMs,
    verifyBacktrackMs: verify.backtrackMs,
    verifyTerminalMs: verify.terminalMs,
    verifyStartAttempts: verify.startAttempts,
    verifySearchSteps: verify.searchSteps,
    verifyTerminalChecks: verify.terminalChecks,
  };
}

function csvHeader() {
  return [
    'case',
    'seed',
    'deadlineExceeded',
    'timeMs',
    'genTotalMs',
    'optionsMs',
    'solutionMs',
    'initialPuzzleMs',
    'carveMs',
    'candidateBuildMs',
    'internalCandidateMs',
    'holeCandidateMs',
    'candidateShuffleMs',
    'candidateLoopMs',
    'applyMs',
    'verifyMs',
    'undoMs',
    'restoreMs',
    'restoreShuffleMs',
    'restoreUndoMs',
    'candidates',
    'internalCandidates',
    'holeCandidates',
    'checkedCandidates',
    'skippedCandidates',
    'acceptedCandidates',
    'alternativeCandidates',
    'removed',
    'restored',
    'finalRemoved',
    'closedWalls',
    'holes',
    'timeout',
    'timeoutInternal',
    'timeoutHole',
    'verifyCalls',
    'verifyTotalMs',
    'verifySetupMs',
    'verifySearchMs',
    'verifyResetMs',
    'verifyQuickRejectMs',
    'verifyEndpointPairMs',
    'verifyPropagateMs',
    'verifyBranchMs',
    'verifyPrepareChoicesMs',
    'verifyCandidateUsagePruneMs',
    'verifyDegreeFeasibilityPruneMs',
    'verifyConnectivityPruneMs',
    'verifyParityPruneMs',
    'verifyForcedMovePruneMs',
    'verifyAdvanceMs',
    'verifyBacktrackMs',
    'verifyTerminalMs',
    'verifyStartAttempts',
    'verifySearchSteps',
    'verifyTerminalChecks',
  ];
}

function csvRow(result: BenchResult) {
  return [
    result.caseName,
    result.seed,
    result.deadlineExceeded,
    ms(result.timeMs),
    ms(result.genTotalMs),
    ms(result.optionsMs),
    ms(result.solutionMs),
    ms(result.initialPuzzleMs),
    ms(result.carveMs),
    ms(result.candidateBuildMs),
    ms(result.internalCandidateMs),
    ms(result.holeCandidateMs),
    ms(result.candidateShuffleMs),
    ms(result.candidateLoopMs),
    ms(result.applyMs),
    ms(result.verifyMs),
    ms(result.undoMs),
    ms(result.restoreMs),
    ms(result.restoreShuffleMs),
    ms(result.restoreUndoMs),
    result.candidates,
    result.internalCandidates,
    result.holeCandidates,
    result.checkedCandidates,
    result.skippedCandidates,
    result.acceptedCandidates,
    result.alternativeCandidates,
    result.removed,
    result.restored,
    result.finalRemoved,
    result.closedWalls,
    result.holes,
    result.timeoutTotal,
    result.timeoutInternal,
    result.timeoutHole,
    result.verifyCalls,
    ms(result.verifyTotalMs),
    ms(result.verifySetupMs),
    ms(result.verifySearchMs),
    ms(result.verifyResetMs),
    ms(result.verifyQuickRejectMs),
    ms(result.verifyEndpointPairMs),
    ms(result.verifyPropagateMs),
    ms(result.verifyBranchMs),
    ms(result.verifyPrepareChoicesMs),
    ms(result.verifyCandidateUsagePruneMs),
    ms(result.verifyDegreeFeasibilityPruneMs),
    ms(result.verifyConnectivityPruneMs),
    ms(result.verifyParityPruneMs),
    ms(result.verifyForcedMovePruneMs),
    ms(result.verifyAdvanceMs),
    ms(result.verifyBacktrackMs),
    ms(result.verifyTerminalMs),
    result.verifyStartAttempts,
    result.verifySearchSteps,
    result.verifyTerminalChecks,
  ];
}

function ms(value: number) {
  return value.toFixed(1);
}

function formatSummary(caseName: string, results: BenchResult[]) {
  return [
    caseName,
    `runs=${results.length}`,
    `time avg/p95=${avg(results, 'timeMs').toFixed(1)}/${p95(results, 'timeMs').toFixed(1)}ms`,
    `stages avg sol/init/carve=${avg(results, 'solutionMs').toFixed(1)}/${avg(results, 'initialPuzzleMs').toFixed(1)}/${avg(results, 'carveMs').toFixed(1)}ms`,
    `carve avg build/shuffle/loop/restore=${avg(results, 'candidateBuildMs').toFixed(1)}/${avg(results, 'candidateShuffleMs').toFixed(1)}/${avg(results, 'candidateLoopMs').toFixed(1)}/${avg(results, 'restoreMs').toFixed(1)}ms`,
    `loop avg apply/verify/undo=${avg(results, 'applyMs').toFixed(1)}/${avg(results, 'verifyMs').toFixed(1)}/${avg(results, 'undoMs').toFixed(1)}ms`,
    `removed avg=${avg(results, 'finalRemoved').toFixed(1)}`,
    `timeout avg=${avg(results, 'timeoutTotal').toFixed(1)}`,
    `deadline stops=${results.reduce((sum, result) => sum + result.deadlineExceeded, 0)}`,
    `holes avg=${avg(results, 'holes').toFixed(1)}`,
  ].join(' | ');
}

function avg(results: BenchResult[], key: NumericResultKey) {
  return results.reduce((sum, result) => sum + result[key], 0) / Math.max(1, results.length);
}

function p95(results: BenchResult[], key: NumericResultKey) {
  const values = results.map((result) => result[key]).sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] ?? 0;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function readArg(name: string) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1) return process.argv[exactIndex + 1];
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readHoleMode(): HoleMode {
  const mode = readArg('--mode') ?? 'two-holes';
  if (mode === 'two-holes' || mode === 'multi-holes' || mode === 'more-holes' || mode === 'one-cycle') {
    return mode;
  }
  throw new Error('Unknown mode. Use --mode=two-holes, --mode=multi-holes, --mode=more-holes, or --mode=one-cycle');
}

function readShortcutOptions(): Partial<VerificationShortcuts> {
  const value = readArg('--shortcuts');
  if (!value || value === 'none') return {};

  const selected =
    value === 'all'
      ? [...shortcutNames]
      : value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);

  const shortcuts: Partial<VerificationShortcuts> = {};
  for (const name of selected) {
    if (!shortcutNames.includes(name as (typeof shortcutNames)[number])) {
      throw new Error(`Unknown shortcut "${name}". Use one of: ${shortcutNames.join(', ')}, all, none`);
    }
    shortcuts[name as keyof VerificationShortcuts] = true;
  }
  return shortcuts;
}

function formatShortcuts(shortcuts: Partial<VerificationShortcuts>) {
  const enabled = shortcutNames.filter((name) => shortcuts[name]);
  return enabled.length === 0 ? 'none' : enabled.join('+');
}

type NumericResultKey = {
  [K in keyof BenchResult]: BenchResult[K] extends number ? K : never;
}[keyof BenchResult];

main();
