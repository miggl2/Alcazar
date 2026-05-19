// 게임 세이브 — 스키마 버전 + try/catch + 마이그레이션 내장
// "업데이트 1번에 전 유저 세이브 증발" 방지

import { z } from 'zod';

/**
 * 세이브 버전 관리 시스템
 *
 * 사용법:
 * 1. 처음 만들 때:
 *    const save = createSaveStore({
 *      key: 'mygame-save',
 *      currentVersion: 1,
 *      schemas: { 1: z.object({ score: z.number(), level: z.number() }) },
 *      defaultData: { score: 0, level: 1 },
 *    });
 *
 * 2. 나중에 스키마 바꿀 때 (예: highScore 추가):
 *    schemas: {
 *      1: oldSchema,
 *      2: newSchema,
 *    },
 *    migrate: {
 *      2: (old) => ({ ...old, highScore: old.score }), // 1→2 변환
 *    },
 *
 * 3. 읽기/쓰기:
 *    const data = save.load();
 *    save.save({ ...data, score: 100 });
 */

type SaveStoreConfig<T> = {
  key: string;
  currentVersion: number;
  schemas: Record<number, z.ZodType<T>>;
  defaultData: T;
  migrate?: Record<number, (oldData: unknown) => T>;
};

type SaveEnvelope<T> = {
  __version: number;
  __savedAt: string;
  data: T;
};

export function createSaveStore<T>(config: SaveStoreConfig<T>) {
  const { key, currentVersion, schemas, defaultData, migrate } = config;

  function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  function load(): T {
    if (!isBrowser()) return defaultData;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultData;

      const parsed = JSON.parse(raw) as Partial<SaveEnvelope<T>>;

      // 구버전 (envelope 없이 평문 저장된 경우) 호환
      if (typeof parsed !== 'object' || parsed === null || !('__version' in parsed)) {
        console.warn(`[save-game] ${key}: 구버전 세이브 발견, 기본값으로 복원`);
        return defaultData;
      }

      const savedVersion = parsed.__version!;
      let data: unknown = parsed.data;

      // 마이그레이션: 저장된 버전 → 현재 버전까지 순차 변환
      if (savedVersion < currentVersion) {
        for (let v = savedVersion + 1; v <= currentVersion; v++) {
          const migrator = migrate?.[v];
          if (!migrator) {
            console.warn(`[save-game] ${key}: 버전 ${v} 마이그레이션 없음, 기본값으로 복원`);
            return defaultData;
          }
          data = migrator(data);
        }
      } else if (savedVersion > currentVersion) {
        // 미래 버전 (앱 다운그레이드 등) — 안전하게 기본값
        console.warn(`[save-game] ${key}: 미래 버전 ${savedVersion} 세이브, 기본값으로 복원`);
        return defaultData;
      }

      // 현재 스키마로 검증
      const schema = schemas[currentVersion];
      if (!schema) {
        console.error(`[save-game] ${key}: 현재 버전 ${currentVersion} 스키마 없음`);
        return defaultData;
      }

      const result = schema.safeParse(data);
      if (!result.success) {
        console.warn(`[save-game] ${key}: 검증 실패, 기본값으로 복원`, result.error);
        return defaultData;
      }

      return result.data;
    } catch (err) {
      // localStorage 차단, JSON 파싱 실패, quota 초과 등 모든 케이스 안전
      console.warn(`[save-game] ${key}: load 실패`, err);
      return defaultData;
    }
  }

  function save(data: T): boolean {
    if (!isBrowser()) return false;

    try {
      const schema = schemas[currentVersion];
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          console.error(`[save-game] ${key}: 저장 전 검증 실패`, result.error);
          return false;
        }
      }

      const envelope: SaveEnvelope<T> = {
        __version: currentVersion,
        __savedAt: new Date().toISOString(),
        data,
      };
      localStorage.setItem(key, JSON.stringify(envelope));
      return true;
    } catch (err) {
      console.warn(`[save-game] ${key}: save 실패`, err);
      return false;
    }
  }

  function clear(): boolean {
    if (!isBrowser()) return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function exists(): boolean {
    if (!isBrowser()) return false;
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  return { load, save, clear, exists };
}
