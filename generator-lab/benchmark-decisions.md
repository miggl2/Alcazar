# Benchmark Decisions

Baseline (`shortcuts=none`, 10 runs, 10s total deadline):

- `two-holes`: highest passed `6x6`; `7x7` hit deadline in all 10 runs.
- `multi-holes`: highest passed `5x5`; `6x6` hit deadline in 1 of 10 runs.

Accepted:

- `forcedTightCell`: `two-holes` improved `6x6 -> 8x8`; `multi-holes` improved `5x5 -> 7x7`. Keep enabled by default.
- `connectivityPrune`: after `forcedTightCell`, `two-holes` improved `8x8 -> 9x9`; `multi-holes` improved `7x7 -> 8x8`. Keep enabled by default.
- `candidateUsagePrune`: after `forcedTightCell + connectivityPrune`, highest record stayed `two-holes 9x9` / `multi-holes 8x8`, but speed improved (`two-holes 9x9: 2972.1ms -> 2238.0ms`, `multi-holes 8x8: 3967.2ms -> 3196.2ms`). Keep enabled by default.
- `choiceOrdering`: after `forcedTightCell + connectivityPrune + candidateUsagePrune`, highest record stayed `two-holes 9x9` / `multi-holes 8x8`, but speed improved (`two-holes 9x9: 2238.0ms -> 1881.9ms`, `multi-holes 8x8: 3196.2ms -> 2888.0ms`). Keep enabled by default.

Current default result (`forcedTightCell + connectivityPrune + candidateUsagePrune + choiceOrdering`, 10 runs, 10s total deadline):

- `two-holes`: highest passed `9x9`; `10x10` hit deadline in 5 of 10 runs.
- `multi-holes`: highest passed `8x8`; `9x9` hit deadline in 5 of 10 runs.

Rejected:

- `degreeFeasibilityPrune`: after `forcedTightCell`, highest record stayed `two-holes 8x8` / `multi-holes 7x7`; `two-holes 8x8` got slower (`361.7ms -> 697.5ms`). Do not enable by default.
- `forcedCandidateNext`: after `forcedTightCell + connectivityPrune + candidateUsagePrune`, highest record stayed `two-holes 9x9` / `multi-holes 8x8`, but speed got worse (`two-holes 9x9: 2238.0ms -> 3221.0ms`, `multi-holes 8x8: 3196.2ms -> 4409.2ms`). Do not enable by default.
- `parityPrune`: current implementation is empty (`return false`), so enabling only adds call overhead. Do not enable by default until implemented.
- `forcedMovePrune`: current implementation is empty (`return false`), so enabling only adds call overhead. Do not enable by default until implemented.

## Forced-edge verifier rewrite

Accepted:

- `forced-edge degree solver`: replaced walk-DFS uniqueness checking with a solver that asks only whether the newly added internal edge or boundary hole can appear in a Hamiltonian path. Uses degree targets, forced propagation, rollback DSU, and a 2-opt witness check. Record improved from current default `two-holes 9x9` / `multi-holes 8x8` to at least `two-holes 13x13` on the first 10-run square scan.
- `dirty-queue propagation`: changed degree propagation from repeated full-board scans to a changed-vertex queue. `14x14 two-holes` improved from `1677.5ms avg, 1 deadline stop` to `380.6ms avg, 0 deadline stops`; record improved to `14x14+`.
- `candidate ordering`: after shuffle, internal candidates are ordered by endpoint touch and solution path-index distance. `16x16 two-holes` improved from `1181.9ms avg, 1 deadline stop` to `358.4ms avg, 0 deadline stops`; record improved from `15x15` to `16x16`.
- `mode-specific candidate ordering`: `two-holes` now uses endpoint-touch first, then short solution-path distance first, with boundary-hole candidates last; `multi-holes` keeps the previous endpoint-touch/long-distance-first order because short-first reduced its record. `two-holes` improved `17x17 -> 18x18`; `18x18` improved `1886.8ms avg, 1 deadline stop -> 783.3ms avg, 0 deadline stops`. `multi-holes` stayed at `19x19`. Keep enabled.
- `large multi-holes distance-16 ordering`: for `multi-holes` at `20x20+`, internal candidates are ordered by closeness to solution-path distance 16, with longer ties first and boundary holes last. This preserves smaller-board records while improving `multi-holes` from `19x19 -> 20x20`; `20x20` improved `6587.9ms avg, 5 deadline stops -> 456.2ms avg, 0 deadline stops`; `21x21` still fails with 1 deadline stop. Keep enabled.

Current accepted exact result, without inconclusive/conservative candidate reject:

- `two-holes`: highest passed `18x18`; `19x19 avg=2918.0ms`, `p95=10000.7ms`, `deadlineStops=2`, `removedAvg=222.1`.
- `multi-holes`: highest passed `20x20`; `21x21 avg=1593.6ms`, `p95=10001.1ms`, `deadlineStops=1`, `removedAvg=338.7`.

Additional modes:

- `more-holes`: runs the normal `two-holes` internal-wall pass first, then builds boundary-hole candidates from that completed puzzle and opens every boundary hole that still preserves exact uniqueness. This is an exact mode and does not use inconclusive rejection.
- `one-cycle`: builds a Hamiltonian cycle solution with no boundary holes, then opens only non-solution internal walls that preserve a unique Hamiltonian cycle. Candidate verification is exact: after opening a chord, the verifier removes that chord and searches for a Hamiltonian path between the chord endpoints; if one exists, the chord would create another cycle and is undone. Odd square sizes are skipped because an odd-cell bipartite grid cannot contain a Hamiltonian cycle. The initial cycle is randomized by making 2x2 block cycles and splicing them with a random spanning tree, then applying exact cycle-preserving local flips; the first deterministic version only rotated/reversed one route and was replaced.

Kept as low-risk support:

- `cycle-edge ban`: unknown edges inside an already selected DSU component are banned during propagation because selecting them can only create a cycle. This lowered hard-case average but did not by itself raise the square-scan record.
- `endpoint quick reject`: internal candidates touching the original solution endpoints are conservatively rejected before exact search. This helped hard-case averages but can reduce wall removal because the puzzle has fixed boundary-hole endpoints.

Rejected:

- `100ms conservative verify budget`: if one candidate could not be proven within the local budget, the generator left that wall/hole closed and recorded it as `inconclusive`. It raised both modes to `20x20` within 10 seconds (`two-holes 20x20 avg=3401.4ms`, `multi-holes 20x20 avg=3551.1ms`), but was rejected because inconclusive candidates are not acceptable for the benchmark. Removed from code; do not retry unless the benchmark definition explicitly allows conservative unknown rejection.
- `component deficit pruning`: checked each selected DSU component's remaining degree deficit against unknown crossing edges. It added overhead and worsened the boundary benchmark (`two-holes 18x18: 1886.8ms avg, 1 deadline stop -> 2540.6ms avg, 2 deadline stops`; `multi-holes 20x20: 6597.2ms avg, 5 deadline stops -> 6661.5ms avg, 5 deadline stops`). Removed from code.
- `connectivity prune every 32 DFS nodes`: tried running available-graph connectivity more often than the accepted every-128 setting. It did not improve the record and slowed `two-holes 18x18` (`1886.8ms -> 2170.3ms`). Removed from code.
- `connectivity prune every 512 DFS nodes`: tried running available-graph connectivity less often. It did not improve the record (`two-holes 18x18: 1912.3ms`, `multi-holes 20x20: 6613.4ms`). Removed from code.
- `endpoint pair parity pruning`: filtered endpoint pairs by bipartite color feasibility before exact search. It did not improve the record and slightly slowed the boundary benchmarks (`two-holes 18x18: 1929.5ms`; `multi-holes 20x20: 6630.7ms`). Removed from code.
- `hole candidates first`: tried opening boundary holes before internal wall candidates so later internal candidates might find alternatives faster. It worsened `multi-holes 20x20` (`6597.2ms avg, 5 deadline stops -> 9520.1ms avg, 8 deadline stops`). Removed from code.
- `branch choice early return on 2 combinations`: stopped scanning branch vertices as soon as a 2-choice vertex appeared. It did not improve the record and slightly slowed boundary benchmarks (`two-holes 18x18: 1912.3ms`; `multi-holes 20x20: 6606.7ms`). Removed from code.
- `short-then-long hybrid candidate ordering`: tried endpoint-touch first, distance-3 chords next, then long chords. It worsened `two-holes 18x18` (`815.4ms avg, 0 deadline stops -> 2154.1ms avg, 2 deadline stops`) and `multi-holes 20x20` (`3379.7ms avg, 3 deadline stops -> 7342.8ms avg, 4 deadline stops`). Removed from code.
