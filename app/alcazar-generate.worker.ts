import { makePuzzle, type MakePuzzleInput } from '@/lib/alcazar-puzzle-factory';

type GenerateRequest = MakePuzzleInput & {
  id: number;
};

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { id, ...input } = event.data;

  try {
    self.postMessage({ id, ok: true, puzzle: makePuzzle(input) });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Puzzle generation failed.',
    });
  }
};
