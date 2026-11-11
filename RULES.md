# Indonesia — rules specification

Source: *Indonesia* rulebook, Splotter Spellen, English, "09" printing (`rules.pdf`, 8 pages; text in
`rules.txt`, page renders in `pages/`). Designers Jeroen Doumen and Joris Wiersinga. BGG id 19777.
Component data (city cards, company deeds, board) is transcribed from the official Tabletop Simulator DLC
(Steam app 468721), whose board is the second-edition print. Where the DLC board and the rulebook disagree
it is recorded under *Open questions*.

Every id below is one assertion. Code cites these ids. Quotes are the rulebook's words; *Reading:* marks an
interpretation I had to make.

---

## C — Components (rulebook p.2)

| id | assertion |
|---|---|
| C1 | One game board: the archipelago map, a Turn Order track (1–5) and a Research & Development table. |
| C2 | 15 city cards, 5 per era (A, B, C), each naming three provinces. See D3. |
| C3 | 24 company deeds: 5 rice, 5 spice, 4 rubber, 4 oil, 6 shipping; 8 era A, 9 era B, 7 era C. See D4. |
| C4 | 5 player aids and screens (the player aid carries the phase list, "Bank" and "Cash" boxes and the goods value table, D1). |
| C5 | Per player colour: 5 cubes (R&D markers), 1 disc (turn order marker), 8 huts (optional ownership markers for goods). |
| C6 | Ships: 5 sets in player colours plus three neutral sets. No count is printed; the book says to use neutral ships when a player runs out (P3.16). *Reading:* ship supply is unlimited. |
| C7 | City markers: 12 of size 1 (amber), 8 of size 2 (green), 3 of size 3 (red), each with a matching goods display. These are **finite** and running out matters (P1.9, P7.5). |
| C8 | Money: coins of 1 and 5, notes of 10, 50, 100, 500 rupiah. *Reading:* the bank is unlimited. |
| C9 | Goods markers for rice, spice, rubber, siap saji and oil: wooden ones mark plantations on the map, cardboard ones mark goods delivered to a city. No count is printed. *Reading:* unlimited. The port shows a good sold with the wooden marker, as the developer's table does. |
| C10 | 16 company start markers (at most 9 are ever needed at once — era B has 9 deeds). |

## S — Preparation (p.3)

| id | assertion |
|---|---|
| S1 | Each player receives a player aid, a screen and **100 rupiah**. |
| S2 | Sort the city cards into piles A, B and C; deal each player one card from each pile. (Two players: two of each, T1.) |
| S3 | Each player takes the wooden markers and ships of one colour. |
| S4 | Each player places a cube on the first slot of each R&D track (every track starts at 1; Turn Order Bid starts at ×1). |
| S5 | Player order is random; mark it with the discs on the Turn Order track. |
| S6 | Sort the deeds into sets A, B and C; take set A and place a start marker on each deed's province. |
| S7 | Agree whether money is open or closed; the default (if not agreed) is closed. See Q-money. |

## G — Game structure (p.3)

| id | assertion |
|---|---|
| G1 | The game is played in three eras, A, B, C. |
| G2 | Each era is a number of years; each year is seven phases in order: 1 New Era, 2 Bid for Turn Order, 3 Mergers, 4 Acquisitions, 5 Research & Development, 6 Operations, 7 City Growth. |
| G3 | The game ends during phase 1 as soon as era C comes to an end (V1). |

## P1 — New Era (p.3)

| id | assertion |
|---|---|
| P1.1 | At the start of phase 1, a new era starts if there are no companies of the current era left to acquire, **or** if all companies left to acquire are of one type (e.g. all spice). |
| P1.2 | Companies that can no longer start because no valid starting area is left for them (P4.6, P4.7) are discarded automatically, and this can trigger P1.1 earlier. *Reading:* evaluate this at the start of phase 1 and again whenever an acquisition would be offered. |
| P1.3 | The first game year always starts an era (era A). |
| P1.4 | When an era starts: players place new cities, then new companies become available (in that order, P1.10). |
| P1.5 | Cities are placed in order of play; each player uses their city card of the new era, which indicates three provinces; the player must build a city in one of those provinces. |
| P1.6 | A new city is size 1 (amber); add its size-1 goods display. |
| P1.7 | A city may be built in any **empty land area that borders on the coast**. Areas containing goods may not be used. |
| P1.8 | Each province may contain at most one city. |
| P1.9 | If the player cannot build a city in any of the three provinces, they discard the city card and pass. They also pass if there are no size-1 city markers left. *Reading:* the card is used up either way (one card per era per player). |
| P1.10 | After every player has built, discard all unacquired companies (deeds and start markers) of the previous era and lay out the next era's set: a start marker on each deed's province. |
| P1.11 | If era C ends, the game ends instead (V1). |

## P2 — Bid for Turn Order (p.4)

| id | assertion |
|---|---|
| P2.1 | Bidding happens in the order of play of the previous year (the current Turn Order track). |
| P2.2 | Each player bids once, in that order, an amount of cash; 0 is allowed. *Reading:* bids are public and sequential (the money is physically placed in the Bank box on the player aid). |
| P2.3 | A bid is paid into the player's **Bank** box. Bank money can never be used again, but counts for victory (V2). |
| P2.4 | Effective bid = cash bid × the player's Turn Order Bid multiplier (D2). A player with a multiplier **must** use it. |
| P2.5 | Highest effective bid plays first, next highest second, and so on. |
| P2.6 | Ties keep the players' relative order from the previous year. |
| P2.7 | A player cannot bid more cash than they have on hand. |

## P3 — Mergers (p.4–5)

| id | assertion |
|---|---|
| P3.1 | Only a player who has researched at least one step on the Mergers track (Mergers ≥ 2) may **announce** a merger. If nobody has, skip the phase. |
| P3.2 | Any player with a free slot, and both owners of the merging companies, may **bid**, regardless of Mergers research. "Merger R&D does NOT influence who may bid." |
| P3.3 | The phase runs in rounds in order of play; each player may announce at most one merger per round; each merger is fully resolved before the next is announced. |
| P3.4 | The phase continues until no player wants to announce another merger. A player may pass in one round and announce in a later one ("it is allowed to pass and then rejoin"). *Reading:* the phase ends when a full round passes with no announcement. |
| P3.5 | A merger is always between exactly two companies; the result may consist of up to five deeds. |
| P3.6 | The announcing player's Mergers level limits the **number of deeds in the resulting company**: Mergers 2 allows results of ≤2 deeds, Mergers 3 ≤3, etc. |
| P3.7 | Each deed can be involved in a merger only once per year: a company formed by a merger this year cannot be merged again until next year's Mergers phase. |
| P3.8 | Mergers are between two companies of the same goods type (rice–rice, shipping–shipping…), except siap saji (P3S). |
| P3.9 | The announcer may own both, one or neither of the companies, but may only announce if they could hold the result: they own one of the two, or they have a free slot. |
| P3.10 | The announcer must make the first bid: either exactly the nominal value, or a valid raised bid. |
| P3.11 | Nominal value = Σ over both companies of (goods or ships on the board × unit value), unit values from D1 (ship 10, rice 20, spice 25, rubber 30, siap saji 35, oil 40). The minimum bid is the nominal value even if the announcer owns both companies. |
| P3.12 | A raise must be the current bid plus a positive multiple of N = total goods/ships of the two companies (e.g. 3+5 rice: 160, 168, 176…). |
| P3.13 | No player may bid more than they have on hand (cash, not Bank). The acquirer must be able to pay the whole bid even if they own one or both companies. |
| P3.14 | Bidding proceeds in order of play among eligible players (P3.2): each in turn either raises or passes; once passed, a player cannot rejoin this auction. Bidding ends when all other eligible players have passed. *Reading:* the announcer may pass once another player has outbid them. |
| P3.15 | The resulting company goes to the highest bidder, who pays the bid split among the former owners in proportion to goods/ships (3 and 5 at 224 → 84 and 140). Because bids are multiples of N the split is exact. A player who owned one of the companies receives their own share back. |
| P3.16 | The deeds of both companies are placed together as one company. For shipping mergers, ships on the board are recoloured to the new owner (ship *type* kept per company so a player's lines stay distinguishable); no ship is ever removed; production companies need no map change. |
| P3.17 | Merged shipping lines add the ship limits of their deeds era by era (Lampung 2/3/4 + Halmahera 3/4/5 = 5/7/9). New ships may be placed adjacent to any of the merged company's ships; the original deed provinces no longer matter. |
| P3.18 | A merged company takes one slot (P5.2). |

### P3S — Siap saji mergers (p.5)

| id | assertion |
|---|---|
| P3S.1 | A siap saji merger is between one rice company and one spice company; the result produces siap saji. |
| P3S.2 | Not allowed in era A; only in era B or C. |
| P3S.3 | Nominal value = (rice goods + spice goods) × 25; raises are multiples of (rice + spice) goods. |
| P3S.4 | The price is split between the former owners in proportion to goods (4 rice + 3 spice → 4/7 and 3/7). |
| P3S.5 | After the merger the new owner must give up **half of the goods of the two old companies, rounded up**, emptying those areas (7 goods → give up 4, keep 3). |
| P3S.6 | Only areas at the border of the company's estate may be given up: no contiguous zone of rice/spice may be broken by removing goods from its middle. *Reading:* goods are removed one at a time and every remaining zone must stay contiguous after each removal. |
| P3S.7 | The remaining rice and spice goods are replaced by siap saji goods. |
| P3S.8 | The sizes of the two companies need not be balanced (a 3-deed spice company may merge with a 1-deed rice company, subject to P3.6). |
| P3S.9 | A siap saji company may only merge with another siap saji company; never again with rice or spice. |

## P4 — Acquisitions (p.5–6)

| id | assertion |
|---|---|
| P4.1 | Rounds in order of play; in each round a player may start **one** available company of the current era, or pass. |
| P4.2 | Once a player passes they may not acquire again this phase. |
| P4.3 | The phase ends when all players have passed or no companies are left. |
| P4.4 | Starting a company costs nothing. The player takes the deed and removes the start marker from the map. |
| P4.5 | A player may never own more companies than their Slots level (D2); a merged company occupies one slot. |
| P4.6 | Production company: the player must place one goods counter on any **empty land area of the deed's province**, but not immediately next to (adjacent to) a goods counter of the same type (any owner). If no such area exists the company cannot be started and is removed from the game. |
| P4.7 | Shipping company: the player places one ship in any **sea area bordering the deed's province**. Existing ships never hinder placement. |
| P4.8 | A player may acquire several companies in one phase (one per round) if they have the slots. |

## P5 — Research & Development (p.6)

| id | assertion |
|---|---|
| P5.1 | Each player advances one marker one step on one R&D track. *Reading:* resolved in order of play (only matters for P5.8); "may" — a player may decline. |
| P5.2 | **Slots**: number of companies the player may own at once; a merged company counts once. |
| P5.3 | **Mergers**: the maximum deeds in a company resulting from a merger this player announces; at 1 they cannot announce (P3.1, P3.6). Owning/bidding on large companies is not limited by this. |
| P5.4 | **Hull**: how many goods each ship belonging to a company **of that player** may carry for each production company during operations (P6P.9). |
| P5.5 | **Expansion**: the maximum number of areas (production) or ships (shipping) a company of the player may add in one operation (P6S.3, P6P.14, P6P.17). |
| P5.6 | **Bid**: the multiplier applied to the player's turn-order bid (P2.4), values ×1, ×5, ×25, ×100, ×400 (D2). |
| P5.7 | Every track has 5 steps; a marker on step 5 cannot advance further. (Board.) |
| P5.8 | Instead of advancing their own marker, a player may advance **another player's Hull** marker. No other track may be advanced for another player. |

## P6 — Operations (p.6–7)

| id | assertion |
|---|---|
| P6.1 | Rounds in order of play. In each round each player operates **one** of their companies and turns its deed(s) face down. |
| P6.2 | A player must operate a company each round while they have un-operated companies, even when it can do nothing useful or is harmful. A player with none left is skipped. |
| P6.3 | The phase ends when every company has operated once. A merged company operates as one. |
| P6.4 | The player chooses freely which of their companies to operate each round. |

### P6S — Operating a shipping company

| id | assertion |
|---|---|
| P6S.1 | Operation = one optional choice: expand. |
| P6S.2 | The company may hold at most the number of ships printed on its deed(s) for the **current era** (summed over merged deeds, P3.17). |
| P6S.3 | It may add up to Expansion (owner's track) ships this operation, never exceeding P6S.2. |
| P6S.4 | Each new ship goes in a sea area that already holds one of the company's ships or is adjacent to such an area; with Expansion ≥2 the second ship may use the area the first just opened. |

### P6P — Operating a production company: sell, income, expand

| id | assertion |
|---|---|
| P6P.1 | A production zone is a set of adjacent land areas with goods of the same type belonging to one company. A company may have several zones only through mergers; each zone is treated separately and needs its own shipping (goods do not move between non-adjacent zones). |
| P6P.2 | Goods are sold to cities. A size-s city buys s of each goods type **that is produced anywhere on the board at that time**; types with no goods on the board are not demanded. Demand is per year: delivered goods accumulate on the city's display until phase 7. |
| P6P.3 | A good can be sold to a city only via a **chain of ships of one shipping company** linking the zone to the city: a ship in a sea area adjacent to the city's land area, which is adjacent to the zone or connected through adjacent sea areas each holding a ship of that company to one that is. |
| P6P.4 | Goods move freely between adjacent areas of a zone, so only some area of the zone needs to touch the first sea area. |
| P6P.5 | Goods never move over land to a city, even an adjacent one. |
| P6P.6 | Different goods may use chains of different shipping companies, but one good cannot switch company mid-chain. A merged shipping company is one company. |
| P6P.7 | Each ship may carry one good **per production company**, plus one more per Hull step above 1 of the ship owner. Ship capacity resets for each production company; city demand does not reset within the phase. *Reading:* two ships of the same company in one sea area are two ships (capacity adds). |
| P6P.8 | The production company's owner receives the goods value (D1) per good sold. |
| P6P.9 | Of that, 5 rupiah per ship-use is paid to the owner of the ships used (a hull-2 ship used twice costs 10). Using your own ships costs nothing net. |
| P6P.10 | Selling is **mandatory and maximal**: the company must sell as many goods as it can, even at a loss. The player chooses among the maximal deliveries (which cities, which lines) — rulebook example p.7. |
| P6P.11 | If the company sold **all** its goods (as many as it has on the board), it **must expand for free** by 1 or more areas, up to the owner's Expansion level. *Reading:* at least one area if any is available, up to the level; see Q-free-expansion. |
| P6P.12 | Expansion areas must be adjacent to one of the company's zones; only empty land areas (a city or any company's goods block); not across sea unless the two land areas are joined by an arrow on the board. |
| P6P.13 | Expansion may not make two companies' zones of the same product adjacent (they would merge visually). If no legal area exists, the company cannot expand. |
| P6P.14 | A merged company expands once per operation (Expansion 2 → 2 goods in total), placed anywhere legal around any of its zones. |
| P6P.15 | If the company did **not** sell all its goods, it **may** buy expansions, up to the Expansion level, at the goods value per area (20 per rice area, etc.), paid to the bank. Placement rules as P6P.12–14. |
| P6P.16 | After operating, the deed is turned face down and the next player operates. |

### P6L — Last earnings double (p.7)

| id | assertion |
|---|---|
| P6L.1 | Money earned in the final year's Operations phase is doubled at game end. Keep each year's operations earnings separate; if the game continues, they become ordinary cash at the start of the next year. |
| P6L.2 | A company operated at a loss (shipping fees exceed income) pays the loss from this year's earnings stack, not from cash; if the stack is empty, the debt is deducted from later earnings this phase, or, if the year's earnings end negative, the negative value is doubled too and paid from cash. |
| P6L.3 | *Reading:* because earnings are kept separate until next year, they cannot fund paid expansions (P6P.15) during the same phase; those come from cash. See Q-earnings. |

## P7 — City growth (p.7–8)

| id | assertion |
|---|---|
| P7.1 | A city grows one size if it received, this year, the full demand of every goods type produced on the board: size 1 needs 1 of each, size 2 needs 2 of each. Size 3 cannot grow. |
| P7.2 | Discard all delivered goods from every city, whether or not it grew. |
| P7.3 | Replace the marker and goods display with the next size (1 amber → 2 green → 3 red). |
| P7.4 | If no marker of the needed size is left, the city cannot grow. |
| P7.5 | If more cities qualify than markers remain, the player first in order of play chooses which grow. |
| P7.6 | "Produced on the board" is literal: early on only rice (maybe spice) is demanded; late, if every rice and spice company has become siap saji, rice and spice are no longer demanded. |

## V — Victory (p.8)

| id | assertion |
|---|---|
| V1 | The game ends in phase 1 when era C ends: no C-era company is left to acquire, or only one type is left (P1.1 applied to era C). |
| V2 | Double the last year's operations earnings (P6L); the player with the most money (cash + Bank) wins. |
| V3 | Tie: the player earlier in the order of play wins. |

## T — Two-player game (p.8)

| id | assertion |
|---|---|
| T1 | Each player receives two city cards of each era at setup. |
| T2 | In each New Era phase both players build two cities each, alternating (first player, second, first, second). |

## M — Map (board) — see `MAP.md` / `src/geometry`

| id | assertion |
|---|---|
| M1 | The map has 26 provinces (D5), each divided into one or more **land areas** by thin lines; a dashed outline groups several islets into one land area. |
| M2 | The sea is divided into **sea areas** by blue lines. Two sea areas are adjacent if they share a border; a sea area borders a land area if they touch. |
| M3 | Double-headed arrows join pairs of land areas across water; such a pair counts as adjacent for expansion (P6P.12) and for zone contiguity. *Reading:* arrows do not join sea areas and are not used for shipping. |
| M4 | Two land areas are adjacent if they share a land border (or an arrow, M3). Provinces borders do not block adjacency. |
| M5 | A land area "borders on the coast" (P1.7) if it touches at least one sea area. |
| M6 | Each province prints its potential per era: a hut (city on a card of that era), a goods icon (production deed of that era) or a ship (shipping deed). These are derivable from D3/D4 and were used to verify the transcriptions. |
| M7 | The Turn Order track (5 spaces) and the R&D table (6 rows × 5 steps on the DLC board; see Q-hull) are printed at the board's lower left. |

## D — Data tables (picture-only values)

### D1 Goods values (player aid)

| good | value | merger unit |
|---|---|---|
| ship | — | 10 |
| transport fee | 5 per ship-use | — |
| rice | 20 | 20 |
| spice | 25 | 25 |
| rubber | 30 | 30 |
| siap saji | 35 | 35 (25 per good at the forming merger, P3S.3) |
| oil | 40 | 40 |

### D2 R&D tracks (board)

| track | steps |
|---|---|
| Turn Order Bid | ×1, ×5, ×25, ×100, ×400 |
| Slots | 1, 2, 3, 4, 5 |
| Mergers | 1, 2, 3, 4, 5 |
| Expansion | 1, 2, 3, 4, 5 |
| Hull (rulebook) — printed as "Hull Player" and "Hull Company" rows on the DLC board | 1, 2, 3, 4, 5 |

### D3 City cards (DLC sheet `indonesia_city_cards`, 15 cards, verified against M6)

| era | provinces |
|---|---|
| A | Sumatera Selatan, Jawa Barat, Jawa Tengah |
| A | Sumatera Selatan, Sulawesi Selatan, Jawa Timur |
| A | Jawa Tengah, Sulawesi Utara, Bali |
| A | Jawa Barat, Sulawesi Utara, Sulawesi Selatan |
| A | Jawa Barat, Bali, Jawa Timur |
| B | Sumatera Utara, Kalimantan Selatan, Maluku |
| B | Sumatera Barat, Kalimantan Selatan, Lampung |
| B | Aceh, Sumatera Utara, Bengkulu |
| B | Aceh, Lampung, Maluku |
| B | Sumatera Barat, Bengkulu, Jawa Barat |
| C | Sarawak, Sulawesi Tengah, Papua |
| C | Halmahera, Jawa Barat, Nusa Tenggara Timur |
| C | Halmahera, Nusa Tenggara Barat, Papua |
| C | Jambi, Sulawesi Tengah, Nusa Tenggara Timur |
| C | Sarawak, Jambi, Nusa Tenggara Barat |

### D4 Company deeds (DLC sheets `indonesia_company_deeds_front/back`, 24 deeds, verified against M6)

| era | type | province | ships A/B/C |
|---|---|---|---|
| A | rice | Bali | |
| A | rice | Jawa Barat | |
| A | spice | Halmahera | |
| A | spice | Maluku | |
| A | shipping | Lampung | 2/3/4 |
| A | shipping | Sulawesi Selatan | 3/3/4 |
| A | shipping | Halmahera | 3/4/5 |
| A | shipping | Jawa Timur | 2/3/3 |
| B | rice | Kalimantan Timur | |
| B | rice | Aceh | |
| B | spice | Jawa Tengah | |
| B | spice | Sulawesi Tengah | |
| B | rubber | Riau | |
| B | rubber | Sumatera Barat | |
| B | rubber | Kalimantan Barat | |
| B | shipping | Sumatera Utara | –/4/5 |
| B | shipping | Jawa Barat | –/4/5 |
| C | rice | Sulawesi Tenggara | |
| C | spice | Sumatera Selatan | |
| C | oil | Sarawak | |
| C | oil | Kalimantan Selatan | |
| C | oil | Papua | |
| C | oil | Maluku | |
| C | rubber | Papua | |

### D5 Provinces (26, as printed on the board)

Aceh, Sumatera Utara, Riau, Sumatera Barat, Jambi, Bengkulu, Sumatera Selatan, Lampung, Jawa Barat,
Jawa Tengah, Jawa Timur, Bali, Nusa Tenggara Barat, Nusa Tenggara Timur, Sarawak, Kalimantan Barat,
Kalimantan Tengah, Kalimantan Timur, Kalimantan Selatan, Sulawesi Utara, Sulawesi Tengah, Sulawesi Selatan,
Sulawesi Tenggara, Halmahera, Maluku, Papua.

Era potential printed per province (A / B / C): Aceh –/rice+city/–; Sumatera Utara –/city+ship/–; Riau
–/rubber/–; Sumatera Barat –/city+rubber/–; Jambi –/–/city; Bengkulu –/city/–; Sumatera Selatan
city/–/spice; Lampung ship/city/–; Jawa Barat city+rice/city+ship/city; Jawa Tengah city/spice/–; Jawa Timur
city+ship/–/–; Bali city+rice/–/–; Nusa Tenggara Barat –/–/city; Nusa Tenggara Timur –/–/city; Sarawak
–/–/city+oil; Kalimantan Barat –/rubber/–; Kalimantan Tengah –/–/–; Kalimantan Timur –/rice/–; Kalimantan
Selatan –/city/oil; Sulawesi Utara city/–/–; Sulawesi Tengah –/spice/city; Sulawesi Selatan city+ship/–/–;
Sulawesi Tenggara –/–/rice; Halmahera spice+ship/–/city; Maluku spice/city/oil; Papua –/–/oil+rubber+city.

---

## Open questions

| id | question | my default if unanswered |
|---|---|---|
| Q-hull | The rulebook has one **Hull** track (P5.4, P5.8). The DLC (2nd-edition) board prints two rows, "Hull Player" and "Hull Company". Which should the port implement, and what does "Hull Company" mean in the edition you want? | Implement the rulebook: one Hull track per player; another player may advance it (P5.8). Render only the rows in use. |
| Q-money | Open or closed money (S7)? Closed money hides cash from opponents; bids and payments are still visible. | A match option ("Money": secret or open), secret by default as the book says. Secret: each player sees only their own cash, Bank and earnings (mat, sparks, player aid show "–" for others) until the game ends, when everyone's amounts and their whole history are shown. Bots read only their own money then and estimate others' from the board. |
| Q-sell | P6P.10: the player must sell the maximum. Should the port (a) let the player assign goods to cities/lines one at a time, offering only choices that keep the maximum reachable, with an "auto: cheapest" button, or (b) auto-resolve the cheapest maximal delivery and only let the player override? | (a). |
| Q-free-expansion | P6P.11 "must expand for free… 1 or more areas, depending on his R&D expansion track": must the player place the full Expansion count when room exists, or at least one? | At least one if any legal area exists, up to the level, player's choice. |
| Q-earnings | P6L.3: may this year's operations earnings be spent on paid expansions (P6P.15) later in the same phase? The book keeps earnings separate until next year. | No: paid expansions come from cash; earnings are unavailable until the year ends. |
| Q-rnd-optional | P5.1 says players "may" research. Allow passing? | Allow, with the research prompt defaulting to a track. |
| Q-auction-announcer | P3.14: the announcer bids first; may they later pass when outbid (obviously yes), and may they raise their own bid when everyone else has passed (no reason to)? | Auction ends when all but the high bidder have passed. |
| Q-ship-type | P3.16 asks for a distinguishable ship *type* per company of one player (the DLC has two ship images per colour). Show the company's deed name on hover instead, and use one ship model? | One model per colour; the company is shown in the ship's summary and highlight. |
| Q-map | The land areas, sea areas and arrows were segmented from the DLC board image; `MAP.md` lists what to check on `art/build/map_check.png` (island-group provinces, arrows read by eye). | as labelled |
| Q-growth-empty | P7.1 when nothing is produced anywhere (year 1 with only shipping lines started): does a city with no demand grow? The book's "needs only rice" example implies at least one good must be produced. | No growth while nothing is produced. |
| Q-route | P6P.10: when one line reaches a city by two routes of different length, the port uses the cheaper route. | cheapest route |
| Q-stall | P1.1 ends an era only when its companies are all started or all of one type, and P4.5 caps companies at the Slots level. If every player's slots are full at Slots 5 and nobody merges to free one, the era, and so the game, never ends. The bots now merge their own companies to free a slot, so a stall needs a table that cannot or will not merge. Should the port add a house rule (e.g. an Acquisitions phase in which nobody may start a company discards the era's remaining companies)? | none yet: no house rule |
