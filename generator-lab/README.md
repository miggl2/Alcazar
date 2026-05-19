# Alcazar Generator Lab

이 폴더는 현재 게임 UI에서 생성기만 떼어낸 실험실입니다. 새 세션에서 이 폴더만 보고 생성 속도, timeout, 벽 제거량을 개선할 수 있게 만든 복사본입니다.

## 실행

프로젝트 루트에서 실행합니다.

```powershell
npx tsc -p generator-lab/tsconfig.json
node generator-lab/dist/benchmark.js --profile smoke
```

조금 더 길게 보려면:

```powershell
node generator-lab/dist/benchmark.js --profile medium
```

큰 판을 확인하려면:

```powershell
node generator-lab/dist/benchmark.js --profile large
```

`large`는 일부 seed에서 오래 걸릴 수 있습니다. 이게 바로 현재 개선해야 할 병목입니다.

검증기 내부 함수별 시간까지 보려면:

```powershell
node generator-lab/dist/benchmark.js --profile smoke --verify-profile
```

기본 벤치는 생성 단계별 시간을 낮은 오버헤드로 기록합니다. `--verify-profile`은 DFS 검증기 안쪽의 prune/choice 비용까지 재므로 원인 분석에는 좋지만, 계측 자체의 `performance.now()` 호출 때문에 절대 시간은 조금 달라질 수 있습니다.

검증 지름길은 기본값에서 모두 꺼져 있습니다. 하나씩 켜서 비교하려면:

```powershell
node generator-lab/dist/benchmark.js --profile smoke --shortcuts=connectivityPrune
```

여러 개를 한 번에 켤 수도 있습니다.

```powershell
node generator-lab/dist/benchmark.js --profile smoke --shortcuts=connectivityPrune,choiceOrdering
```

4x4부터 정사각형 기록을 올려 보려면:

```powershell
node generator-lab/dist/benchmark.js --square-scan --mode=two-holes --runs=10
```

여러 구멍 모드로 재려면:

```powershell
node generator-lab/dist/benchmark.js --square-scan --mode=multi-holes --runs=10
```

## 파일

- `alcazar-generator.ts`: 본 게임의 `lib/alcazar-generator.ts`를 복사한 실험 대상입니다.
- `benchmark.ts`: 여러 판 크기와 hole 모드를 돌리며 속도와 timeout을 CSV처럼 출력합니다.
- `tsconfig.json`: 이 폴더만 빌드해 `dist`에 JS를 만듭니다.

## 지표 읽는 법

- `timeMs`: 퍼즐 하나를 생성하는 데 걸린 시간입니다.
- `removed`: 유일해를 유지한다고 판정되어 제거된 벽 수입니다. k 복원 전 최대 제거 상태입니다.
- `restored`: k 때문에 다시 막은 벽 수입니다. 벤치마크 기본값은 `restoreRatio: 0`이라 보통 0입니다.
- `finalRemoved`: 실제 최종 제거량입니다.
- `closedWalls`: 최종적으로 남은 닫힌 벽 수입니다.
- `holes`: 열린 외곽 구멍 수입니다.
- `timeout`: 전체 생성 제한 시간에 걸려 undo한 후보 수입니다.
- `deadlineExceeded`: 퍼즐 하나가 처음부터 끝까지 10초 제한에 걸렸으면 1입니다.

## 타이밍 지표

벤치 CSV에는 생성 전 과정의 시간 열이 함께 출력됩니다.

- `timeMs`: 벤치마크가 바깥에서 잰 전체 실행 시간입니다.
- `genTotalMs`: 생성기 내부에서 잰 전체 시간입니다.
- `solutionMs`: 해답 Hamiltonian path를 만드는 시간입니다.
- `initialPuzzleMs`: 해답 길과 최초 구멍 2개로 초기 퍼즐을 만드는 시간입니다.
- `carveMs`: 후보 벽/구멍을 열어 보며 유일해를 유지하는지 검증하는 전체 시간입니다.
- `candidateBuildMs`: 내부 벽 후보와 외곽 구멍 후보를 만드는 시간입니다.
- `candidateShuffleMs`: 후보 순서를 섞는 시간입니다.
- `candidateLoopMs`: 후보마다 apply, verify, undo를 수행하는 루프 시간입니다.
- `applyMs`, `verifyMs`, `undoMs`: 후보 루프 안의 누적 시간입니다.
- `restoreMs`: `restoreRatio`만큼 다시 막는 복원 단계 시간입니다.
- `verifyTotalMs`: 모든 후보 검증 시간의 합입니다.
- `verifyQuickRejectMs`: endpoint/2-opt 같은 즉시 reject 검사 시간입니다.
- `verifyEndpointPairMs`: 가능한 boundary-hole endpoint 쌍을 만드는 시간입니다.
- `verifyPropagateMs`: degree target, cycle ban, 강제 선택/금지 전파 시간입니다.
- `verifyBranchMs`: 다음 분기 정점을 고르는 시간입니다.
- `verifyPrepareChoicesMs`, `verifyDegreeFeasibilityPruneMs`, `verifyConnectivityPruneMs` 등 `verify*` 내부 열은 `--verify-profile`을 켰을 때 채워집니다.

## 현재 검증 구조

현재 유일해 검증은 기존의 "경로를 한 칸씩 걷는 DFS"가 아니라, 새로 연 후보를 반드시 포함하는 Hamiltonian path witness가 있는지만 찾습니다.

- 내부 벽 후보는 해당 간선을 강제로 선택합니다.
- 외곽 구멍 후보는 해당 칸이 endpoint가 되는 경우만 검사합니다.
- 각 정점은 endpoint면 degree 1, 나머지는 degree 2를 목표로 둡니다.
- `need == 0`, `need == remain`이면 incident edge를 금지/선택으로 전파합니다.
- rollback DSU로 cycle을 막고, 이미 같은 component 안에 있는 unknown edge는 즉시 금지합니다.
- 2-opt witness와 endpoint 후보는 exact search 전에 빠르게 reject합니다.

현재 10회 평균 기준 기록:

- `two-holes`: highest passed `18x18`; `19x19 avg=2918.0ms`, `p95=10000.7ms`, `deadlineStops=2`
- `multi-holes`: highest passed `20x20`; `21x21 avg=1593.6ms`, `p95=10001.1ms`, `deadlineStops=1`

## 현재 꺼둔 검증 지름길

유일해 검증 DFS 안에는 원래 아래 시간 단축용 메소드들이 있었습니다. 지금은 정확한 baseline을 잡기 위해 기본값에서 모두 비활성화했습니다.

- `candidateUsagePrune`: 추가한 후보 벽/구멍을 더 이상 사용할 수 없는 탐색 가지를 버립니다.
- `forcedCandidateNext`: 후보를 아직 안 썼고 현재 칸이 후보 한쪽 끝이면 그 후보로 강제 이동합니다.
- `forcedTightCell`: 남은 칸 중 선택지가 너무 좁은 칸이 있으면 다음 이동을 강제하거나 막습니다.
- `degreeFeasibilityPrune`: 남은 칸들이 최종 경로 차수를 만족할 수 있는지 미리 검사합니다.
- `connectivityPrune`: 아직 방문하지 않은 칸들이 현재 위치에서 모두 이어질 수 있는지 검사합니다.
- `choiceOrdering`: 후보 사용 가능성 및 onward count로 다음 이동 순서를 정렬합니다.
- `parityPrune`, `forcedMovePrune`: 자리만 있고 현재 구현은 비어 있습니다.

다음 실험은 `--shortcuts=<이름>`으로 하나씩 켜고, 4x4부터 정사각형 판을 10회 평균으로 비교하는 방식으로 진행합니다. 퍼즐 하나가 10초를 넘으면 그 크기는 중단된 것으로 봅니다.

## 현재 병목

현재 병목은 "대체 해가 없다"를 증명하기 어려운 일부 후보입니다. 후보별 보수 reject 없이 정확 기준으로 검사하므로, 어려운 후보 하나가 전체 10초 deadline을 소모할 수 있습니다.

다음 개선 후보:

- 보수 reject를 줄이는 더 강한 exact pruning: component별 남은 degree deficit, articulation/bridge 기반 pruning.
- 후보 순서 개선: 긴 chord 우선 외에 2-opt witness가 생기기 쉬운 후보를 더 정교하게 앞세우기.
- endpoint quick reject의 puzzle-hole 조건 정밀화: 지금은 속도 우선 보수 reject라 제거량을 깎을 수 있습니다.

## 원본에 반영하는 법

여기서 개선한 뒤 `generator-lab/alcazar-generator.ts`의 변경점을 `lib/alcazar-generator.ts`로 옮기면 됩니다. UI는 이 폴더와 연결되어 있지 않습니다.
