# Rules conformance audit

Every id in `RULES.md`, with the code that implements it. Status: ✅ implemented, ⚠️ deviates (with the reading
taken), ❌ missing, 🎨 deliberate simplification. Mechanical checks at the end.

## Components and setup

| Rule | Status | Location | Note |
|---|---|---|---|
| C1 | ✅ | `MainBoard.build`, `geometry/map.ts` | board, Turn Order track and R&D table from the print |
| C2, D3 | ✅ | `consts.ts` CITY_CARDS (asserted 15, 5 per era); `CityCard.hiddenPropertiesForSerialization` | a card's face is hidden from everyone but its holder (and undealt cards from everyone) until its era begins; then it is turned face up, used and discarded |
| C3, D4 | ✅ | `consts.ts` DEEDS (asserted 24 by type and era) | |
| C4 | ✅ | `PlayerAid.tsx` | the aid is a dropdown |
| C5 | ✅ | `Cube`, `Disc`; the ownership hut is drawn beside every goods marker (`GoodsMarker` ornament, recoloured on merger) | ⚠️ the box has 8 huts per player; the port draws one per plantation without a limit (Q-huts) |
| C6 | ✅ | `Ship`; unlimited | neutral ships never needed: a merged line recolours its ships |
| C7 | ✅ | `CitySupply` 12/8/3 | finite, on the table |
| C8, C9 | ✅ | money is a number; goods markers unlimited | goods sold are shown with the wooden goods markers, not the book's cardboard counters (the developer's table) |
| C10 | ✅ | `StartMarker`, `setup.layOutStartMarkers` | |
| S1 | ✅ | `setup.ts` STARTING_CASH | |
| S2, T1 | ✅ | `setup.ts` (two per era with two players) | |
| S3 | ✅ | `setup.ts` seat colours | |
| S4 | ✅ | `setup.ts` cubes on step 1 | |
| S5 | ✅ | `setup.ts` shuffle, discs | |
| S6 | ✅ | `setup.ts` era A deeds + markers | |
| S7 | ✅ | `Root.money` match option, secret by default (`src/secret.ts`, Q-money) | open money is the other choice; the tutorial plays with it open |
| G1–G3 | ✅ | `Indonesia.run` | |

## Phase 1

| Rule | Status | Location | Note |
|---|---|---|---|
| P1.1 | ✅ | `phase1NewEra.ts` eraOver | |
| P1.2 | ✅ | `removeUnstartable` at phase 1 and before each acquisition round | |
| P1.3 | ✅ | year 1 branch | |
| P1.4, P1.10 | ✅ | `buildCities` then `layOutEra` | |
| P1.5 | ✅ | `buildCity`: pick among `legalCitySites` | |
| P1.6 | ✅ | `City` size 1 | |
| P1.7, P1.8 | ✅ | `MainBoard.legalCitySites` | |
| P1.9 | ✅ | `buildCity`: card discarded, pass on no site or no marker | |
| P1.11, V1 | ✅ | `ending` branch | |

## Phase 2

| Rule | Status | Location | Note |
|---|---|---|---|
| P2.1 | ✅ | `executeBidForTurnOrder` iterates last year's order | |
| P2.2 | ✅ | sequential public bids | |
| P2.3 | ✅ | `addBank` | Bank counted in `Player.total` (V2) |
| P2.4 | ✅ | BID_MULTIPLIER applied always | |
| P2.5, P2.6 | ✅ | stable sort by effective bid | |
| P2.7 | ✅ | +n buttons gated by cash | |

## Phase 3

| Rule | Status | Location | Note |
|---|---|---|---|
| P3.1 | ✅ | mergers ≥ 2 to announce; phase skipped when nobody can | |
| P3.2 | ✅ | `runAuction` eligible = owners ∪ free slot | |
| P3.3 | ✅ | round loop, one announcement per player per round | |
| P3.4 | ✅ | loop ends after a round with no announcement | |
| P3.5 | ✅ | two companies | 5-deed cap is implied by Mergers ≤ 5 |
| P3.6 | ✅ | `legalMergers` deed count ≤ announcer's level | |
| P3.7 | ✅ | `mergedThisYear`, reset in phase 1 | |
| P3.8 | ✅ | same type unless siap saji | |
| P3.9 | ✅ | owns one or has a free slot | |
| P3.10 | ✅ | opening bid ≥ nominal, in units | |
| P3.11 | ✅ | `mergerTerms` | |
| P3.12 | ✅ | raises in multiples of unit | |
| P3.13 | ✅ | buttons gated by cash; an announcer who cannot pay the nominal cannot announce | |
| P3.14 | ✅ | pass is final; ends when all others passed | |
| P3.15 | ✅ | `resolveMerger` split by pieces | |
| P3.16 | ✅ | deeds combined, ships recoloured; a player's lines alternate prahu and steamer (`Ship.ts`, Q-ship-type) | |
| P3.17 | ✅ | `Company.shipLimit` sums deeds; expansion from any ship | |
| P3.18 | ✅ | one Company chit = one slot | |
| P3S.1–P3S.4 | ✅ | `legalMergers`, `mergerTerms(siapSaji)` | |
| P3S.5–P3S.7 | ✅ | `giveUpHalf`: contiguity kept; rest become siap saji | ⚠️ reading: a whole zone may be removed entirely, which keeps every remaining zone contiguous |
| P3S.8 | ✅ | no balance check | |
| P3S.9 | ✅ | siap saji only merges with siap saji (same-type rule) | |

## Phase 4

| Rule | Status | Location | Note |
|---|---|---|---|
| P4.1–P4.3 | ✅ | `executeAcquisitions` rounds, pass set | |
| P4.4 | ✅ | `acquire` | |
| P4.5 | ✅ | `freeSlots` gate before the prompt | |
| P4.6 | ✅ | `legalStartAreas` (not adjacent to same good); unstartable deeds removed by P1.2 | |
| P4.7 | ✅ | `legalShipStarts` | |
| P4.8 | ✅ | one per round, rounds repeat | |

## Phase 5

| Rule | Status | Location | Note |
|---|---|---|---|
| P5.1 | ✅ | one cube one step; pass allowed (Q-rnd-optional) | |
| P5.2–P5.6 | ✅ | `rnd` levels read by the phases that use them | |
| P5.7 | ✅ | options exclude step 5 | |
| P5.8 | ✅ | other players' Hull cubes offered | |

## Phase 6

| Rule | Status | Location | Note |
|---|---|---|---|
| P6.1–P6.4 | ✅ | `executeOperations` | a player with none left is skipped |
| P6S.1–P6S.4 | ✅ | `operateShipping`, `shipExpansionTargets` | the second ship may use the area the first opened (targets recomputed per ship) |
| P6P.1 | ✅ | `zonesOf`, per-zone source nodes | |
| P6P.2 | ✅ | city demand = size per produced good, less delivered this year | |
| P6P.3–P6P.7 | ✅ | `logistics.ts` flow network; per-line nodes, hull × ships per sea, uses spent per company | checked by `scripts/test/logistics.ts` |
| P6P.8, P6P.9 | ✅ | `deliverOne` | fee waived for own ships |
| P6P.10 | ✅ | maximum computed first; only choices that keep it are offered (`legalDeliveryChoices`) | 🎨 the route for a chosen (zone, line, city) is the cheapest one; the book lets the player pick any route |
| P6P.11 | ✅ | `expand(…, "free")`: every area up to the Expansion level is mandatory while one is legal (Q-free-expansion) | |
| P6P.12, P6P.13 | ✅ | `expansionTargets` | |
| P6P.14 | ✅ | one expansion loop per company | |
| P6P.15 | ✅ | paid expansion from cash | |
| P6P.16 | ✅ | `setOperated(true)` | |
| P6L.1 | ✅ | earnings settled in phase 1; doubled when the game ends there | kept apart in `Player.earnings` (paid expansion spends `cash` only); the mat's Cash and the cash spark show spendable cash, with "+N earned this year" under it |
| P6L.2 | ⚠️ | `addEarnings(-fee)` lets the earnings stack go negative; it is settled against cash in phase 1 | a negative year is subtracted (doubled at the end) from cash, as the book says; no mid-phase bookkeeping needed |
| P6L.3 | 🎨 | earnings cannot fund paid expansions (Q-earnings) | |

## Phase 7, victory, two players, map

| Rule | Status | Location | Note |
|---|---|---|---|
| P7.1 | ✅ | `cityCanGrow` | ⚠️ with nothing produced on the board every size 1 and 2 city grows (Q-growth-empty) |
| P7.2 | ✅ | delivered goods sink into their city, then the display follows (`City.clearGoods`, `closeDisplay`) | |
| P7.3 | ✅ | size++ and ring colour; the display comes out next time at the new size (`City.openDisplay`) | |
| P7.4, P7.5 | ✅ | supply check; first player chooses | size 2 → 3 resolved before 1 → 2, and the size-2 markers returned are available to the size 1 cities (⚠️ reading, Q-growth-order) |
| P7.6 | ✅ | `producedGoods` | |
| V1–V3 | ✅ | `Indonesia.run` end; `executeNewEra` | tie → earlier in order of play; at the end each Bank is emptied into cash (after secret money is revealed), so a player's total is one pile |
| T1, T2 | ✅ | `setup.ts`, `buildCities` | |
| M7 | ✅ | `Tracks` panel | the Turn Order track and R&D table are cut from the board into their own panel (the board shows sea paper there) |
| M1–M6 | ✅ | `geometry/map.ts`, `mapIndex.ts` | 36 arrows, 10 islet groups; province membership of islets per MAP.md (Q-map) |
| D1, D2 | ✅ | `consts.ts` | |
| D5 | ✅ | `PROVINCES` asserted 26 | |

## Mechanical checks

- `npx tsc --noEmit -p .` clean.
- `scripts/render-reads.mjs src`: 0 reads to review.
- `scripts/ai-soak.mjs`: 5/5 at 2 players, 6/6 at 3, 10/10 at 4, 6/6 at 5 (one earlier 2-player game ran 3,776 years
  before the empty-board growth fix; none since).
- `turn.pick` arrays are not built by mapping options into picks (the bid/auction adjust buttons map over four
  increments, which is four verbs about the prompt, not four options).
- No `Math.random`, `Date.now` or module-level mutable state in game logic; all randomness is `turn.takeRng`.
- Every `new GoodsMarker` / `new Ship` is an unlimited supply by the book (C6, C9); city markers are finite.
- `minPlayers 2`, `maxPlayers 5` match the rulebook. `implementationNotes` lists only where the port differs from the
  2009 rulebook and its components: the unused "Hull Company" row of the second-edition board, a sale taking
  its line's cheapest route through the ship picked (P6P.10) and unlimited huts (C5). Readings of the rules and the match options are not repeated there.

## Not implemented

- Choosing a specific route when several routes of one line reach the same city at different fees (P6P.10): the
  cheapest route is used.
