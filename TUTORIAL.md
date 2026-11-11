# The tutorial: outline

Agreed with the developer (2026-11-01): **three players** (you and two bots), the rulebook's **onlooker** as the
narrator, and **a complete teach**: every rule in `RULES.md` is shown or explained (the coverage table below,
checked by `yarn tutorial:coverage`). The first version stopped at your first merger and left the rest to the
player aid; the developer: "I want the tutorials to be COMPLETE TEACHES OF THE GAME… What you have here is not
actually useful to anyone." Indonesia has no factions or card powers, so nothing is left out. The lesson plays
three years, into era B, and then the match carries on as a normal game (`end: "continue"`).

The script is `src/tutorial/script.ts`, its words `src/tutorial/strings.en.json`, the frozen game
`src/tutorial/pins.json`; tooling in `scripts/tutorial/` (see its README).

## The rule above all others

**Explain it as if they don't know the game at all, from first principles** (the developer, 2026-11-01). The
listener has never seen Indonesia or any game like it: no "goods", "deeds", "slots", "operate" or "rupiah" until
the narration has built each from nothing, on the real piece, the first time it appears. Before writing a step,
ask what the listener must already understand for it to make sense, and make sure an earlier step taught exactly
that. Read the finished script (`yarn tutorial:cues`) as that person.

Not everything has to be explained at its first mention. But anything named before it is explained gets a
signpost ("we'll come back to that", "more on these when they matter"), so nobody feels lost (the developer,
2026-11-01).

## The voice

The rulebook's overview is told by someone watching the table ("Judging by the smirk on the face of the Sultan of
Solo, the businessman from North Sumatra has just made a mistake…"). The narrator is that onlooker: wry and well
informed, speaking to you, the newcomer. Short sentences, plain words, no archaisms. The two bots are the overview's
characters, the Sultan of Solo and the businessman from North Sumatra ("the Sumatran"), and nothing is added to them
that the rulebook doesn't say. They are introduced when they first act, not in the opening.

**Open with the goal, not a cast** (the developer: naming players and ringing their mats "with no context" is "a bad
intro to a teach"). The first words are the rulebook's: "Indonesia is a game about getting rich."

**No inventories** (the developer: "anytime it's 'that's a thing and that's a thing and that's a thing' it's kinda
sloppy"). A thing comes in through what it's for, at the moment it matters; a group of things is one idea and one
ring ("each track improves something different; I'll explain each when it matters"), not a tour with a ring each.

## The game it plays (forced deal, steered bots)

All of Indonesia's randomness is spent in setup (city cards and the order of play), so the deal is forced, not
searched: your cards name Jawa Barat (A) and Lampung (B), the Sultan's Bali (A) and Maluku (B), the Sumatran's
Sumatera Selatan (A) and Sumatera Utara (B). The bots are steered while the run is recorded (`steer` in the
script), then every move is frozen in the pins. Every rupiah below is what the recorded game does.

**Year 1 (era A).** Cities: the Sultan in Bali, the Sumatran in Sumatera Selatan, you on Jawa Barat's north coast
(141). Bids: the Sultan 0, the Sumatran 10, you 5, so the order is Sumatran, you, Sultan. The Sumatran starts the
Lampung line, first ship in sea 126 (Sunda side); you start Jawa Barat rice on 144, which touches only sea 126; the
Sultan starts Bali rice. Research: the Sumatran and the Sultan take Slots, you take Mergers. Operations: the
Sumatran adds the line's second ship in sea 127, beside your city (the era A limit); your rice rides **both ships**
to your city (20, less 10 in fees, and selling is compulsory); you sold everything, so you expand for free to 136;
Bali rice has no ship and sells nothing. Your city grows to size 2.

**Year 2 (era A).** Era A goes on: spice and shipping are still on offer. Everyone bids 0. You announce the merger
of Jawa Barat rice and Bali rice by tapping their plantations; the Sultan raises to 63, the Sumatran (free slot)
passes, you bid 66, the Sultan passes: 44 back to you, 22 to the Sultan. The Sumatran starts Halmahera spice; the
Sultan starts Maluku spice and passes. Research: the Sumatran takes Hull (2), you take Mergers (3), the Sultan
Slots. Operations: the Lampung line is at its era A limit and has nothing to do; Halmahera spice sells nothing;
your rice sells two (Hull 2 lets the ship by your city carry both; the touching plantations are one group, so both
leave from 136) and Bali rice can't move, so you don't sell out: you are offered paid growth and decline; the
Sultan pays 25 to grow Maluku spice. Spice is now grown, so no city grows.

**Year 3 (era B).** Only shipping lines are left, all one kind: era A ends. Era B cities: the Sumatran in
Sumatera Utara, you in Lampung (130, on both of the line's seas), the Sultan in Maluku. The unstarted shipping
lines are discarded and era B's companies come out (the symbols' B column). Everyone bids 0. You announce the
**siap saji** merger of your rice with the Sumatran's Halmahera spice (three deeds, Mergers 3): 4 goods at 25
open at 100; the Sultan can't afford to raise, the Sumatran passes; 75 back to you. You give up the Halmahera
spice and the Bali rice; the two Jawa Barat plantations become siap saji. The Sumatran starts Sumatera Barat
rubber on 45, which keeps the Sultan's Riau rubber off 39 and 48 (same goods never touch); the Sultan passes.
Research: you take Expansion (2). Operations: the Lampung line adds its third ship (era B limit); your siap saji
sells out (one to each of your cities, 70 less 10), so you grow for free by two areas (135, 139). Nobody else
sells; no city grows. Then the ending is explained: era C, the end at the start of a year, the last year's
earnings doubled, cash and Bank, ties.

## Coverage

Every rule in `RULES.md`, and where the lesson teaches it. `shown`: it happens on the board in that step;
`explained`: the narrator says it while its piece or place is ringed. `yarn tutorial:coverage` fails on any rule
missing here.

| rule | how | step |
|---|---|---|
| C1 | explained | map, order, research |
| C2 | explained | city-cards |
| C3 | explained | companies |
| C4 | explained | year (the player aid) |
| C5 | shown | order (discs), research (cubes), plantation-placed (huts) |
| C6 | shown | others-sumatran-company |
| C7 | explained | growth |
| C8 | skip | money is a number in the port; nothing to learn |
| C9 | shown | place-plantation |
| C10 | shown | companies |
| S1 | explained | goal |
| S2 | explained | city-cards |
| S3 | skip | the game hands out the colours |
| S4 | explained | research |
| S5 | explained | order |
| S6 | shown | companies |
| S7 | explained | goal |
| G1 | explained | city-cards |
| G2 | explained | year |
| G3 | explained | ending |
| P1.1 | shown | year-2 (explained), year-3 (shown) |
| P1.2 | explained | era-b-companies |
| P1.3 | shown | city-cards |
| P1.4 | shown | others-sumatran-city-b, era-b-companies |
| P1.5 | shown | others-sultan-city, your-card |
| P1.6 | shown | display (the size 1 display comes out of your city with your rice) |
| P1.7 | explained | build-city |
| P1.8 | explained | your-card |
| P1.9 | explained | others-sultan-city-b |
| P1.10 | shown | era-b-companies |
| P1.11 | explained | ending |
| P2.1 | explained | bid-explain, others-sumatran-bid-2 |
| P2.2 | shown | others-sumatran-bid |
| P2.3 | shown | new-order |
| P2.4 | explained | others-sumatran-bid-2 |
| P2.5 | shown | new-order |
| P2.6 | explained | bid-explain, bid-2 |
| P2.7 | explained | bid-explain |
| P3.1 | shown | no-mergers, mergers-now |
| P3.2 | explained | merger-table, others-sumatran-passes |
| P3.3 | explained | merger-rules |
| P3.4 | explained | merger-rules |
| P3.5 | explained | mergers-now |
| P3.6 | explained | mergers-now, siap-saji |
| P3.7 | explained | merger-rules |
| P3.8 | explained | mergers-now |
| P3.9 | explained | merger-rules |
| P3.10 | shown | open-bid |
| P3.11 | explained | merger-table, ss-table |
| P3.12 | shown | others-sultan-raises |
| P3.13 | explained | raise, others-pass-ss |
| P3.14 | shown | others-sumatran-passes |
| P3.15 | shown | payout, won |
| P3.16 | shown | won |
| P3.17 | explained | merger-rules |
| P3.18 | explained | won |
| P3S.1 | shown | siap-saji |
| P3S.2 | explained | siap-saji |
| P3S.3 | shown | ss-table |
| P3S.4 | shown | give-up-why |
| P3S.5 | shown | give-up, give-up-2 |
| P3S.6 | explained | give-up-why |
| P3S.7 | shown | siap-saji-made |
| P3S.8 | explained | siap-saji-how |
| P3S.9 | explained | siap-saji-made |
| P4.1 | explained | acquisitions-2 |
| P4.2 | shown | acquisitions-2, others-sultan-spice |
| P4.3 | explained | acquisitions-2 |
| P4.4 | explained | slots |
| P4.5 | explained | slots, acquisitions-2 |
| P4.6 | shown | place-plantation (explained), others-sultan-rubber (shown) |
| P4.7 | shown | others-sumatran-company |
| P4.8 | explained | acquisitions-2 |
| P5.1 | shown | research |
| P5.2 | explained | slots, others-sumatran-research |
| P5.3 | explained | research-mergers, mergers-now |
| P5.4 | explained | others-sumatran-hull, selling-2 |
| P5.5 | shown | free-expansion (explained), expand-ss-2 (shown) |
| P5.6 | explained | others-sumatran-bid-2 |
| P5.7 | explained | research |
| P5.8 | explained | others-sumatran-hull |
| P6.1 | explained | operations |
| P6.2 | explained | operations |
| P6.3 | explained | operations |
| P6.4 | explained | operations |
| P6S.1 | shown | others-sumatran-operate |
| P6S.2 | shown | others-sumatran-company (the deed), lampung-full, others-sumatran-ship-3 |
| P6S.3 | explained | others-sumatran-operate |
| P6S.4 | shown | others-sumatran-operate |
| P6P.1 | explained | sold-2 |
| P6P.2 | shown | city-built (explained), display, spice-now |
| P6P.3 | shown | selling, sold |
| P6P.4 | shown | sold-2 |
| P6P.5 | explained | selling |
| P6P.6 | explained | selling |
| P6P.7 | shown | sold, selling-2 |
| P6P.8 | shown | sold |
| P6P.9 | shown | sold |
| P6P.10 | explained | forced |
| P6P.11 | shown | free-expansion |
| P6P.12 | explained | free-expansion |
| P6P.13 | explained | others-sultan-rubber |
| P6P.14 | shown | expand-ss-2 |
| P6P.15 | shown | paid-expansion (explained), others-sultan-pays (shown) |
| P6P.16 | explained | confirm-operate |
| P6L.1 | shown | sold, year-2 |
| P6L.2 | explained | forced |
| P6L.3 | explained | paid-expansion |
| P7.1 | shown | growth, growth-2 |
| P7.2 | explained | growth (the goods go into their city, then the display) |
| P7.3 | shown | growth (the display will come out with two circles), ss-sold |
| P7.4 | explained | growth |
| P7.5 | explained | growth |
| P7.6 | explained | spice-now, growth-3 |
| V1 | explained | ending |
| V2 | explained | ending |
| V3 | explained | ending |
| T1 | skip | two-player games only (the lesson has three) |
| T2 | skip | two-player games only |
| M1 | explained | map |
| M2 | explained | map |
| M3 | explained | map, free-expansion |
| M4 | explained | free-expansion |
| M5 | explained | build-city |
| M6 | explained | symbols, era-b-companies |
| M7 | shown | order, research |
