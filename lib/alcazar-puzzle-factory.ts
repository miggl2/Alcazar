import {
  createSeededRng,
  generatePuzzle,
  type GeneratedPuzzle,
  type HoleMode,
} from '@/lib/alcazar-generator';

export function hashSeedText(seedText: string) {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mixSeed(seed: number, ...parts: number[]) {
  let value = seed >>> 0;
  for (const part of parts) {
    value ^= part >>> 0;
    value = Math.imul(value, 2246822519) >>> 0;
    value ^= value >>> 13;
    value = Math.imul(value, 3266489917) >>> 0;
  }
  return value >>> 0;
}

export type MakePuzzleInput = {
  width: number;
  height: number;
  mode: HoleMode;
  k: number;
  seedText: string;
  difficulty: number;
};

export function makePuzzle({
  width,
  height,
  mode,
  k,
  seedText,
  difficulty,
}: MakePuzzleInput): GeneratedPuzzle {
  const baseSeed = hashSeedText(seedText);
  const solutionSeed = mixSeed(baseSeed, width, height, 0xA1CA2A7);
  const modeSeed = mode === 'two-holes' ? 0 : mode === 'more-holes' ? 1 : 2;
  const carveSeed = mixSeed(baseSeed, width, height, modeSeed, difficulty, 0xBEEFCACE);

  return generatePuzzle(
    width,
    height,
    mode,
    createSeededRng(solutionSeed),
    {
      restoreRatio: k,
      solutionDeadlineMs: 300,
      totalDeadlineMs: Number.POSITIVE_INFINITY,
    },
    baseSeed,
    createSeededRng(carveSeed)
  );
}
