# The map, as data

Built by `scripts/geometry/build_map.py` from the DLC board texture (`art/board_diffuse.png`, 4096×4096; the
printed board is the lower band, 3912×1858 px after cropping the black margins). The hand identification is
`scripts/geometry/map_labels.json`; the generated module is `src/geometry/map.ts`. Check render:
`art/build/map_check.png` (provinces coloured and named, land areas numbered, sea areas `S<n>`, dashed islet
groups boxed in magenta, arrows drawn green where the detector found them and orange where I read them off
the board by eye).

## How it was detected

- **Barrier** = black ink (coast and province outlines, icons, lettering) + thin brown area lines (black-hat
  filter, 9 px, components ≥ 30 px long) + blue (the sea-area lines and the soft coast glow) + a 2-px fence
  along the paper frame. Regions are the connected components of the rest.
- **Land vs sea** by paper hue: sea paper is blue-grey (hue 85–130) and no lighter than luma 208; land paper is
  warm, or (for the smallest islets) a near-white. Anything touching the frame is sea.
- **Provinces**: land regions whose shared border is less than half black-line core are the same province
  (the brown area lines); a black border is a province border. The clustering got 49 clusters for 26
  provinces, because several provinces are made of islands with no shared border; the labels file joins them.
- **Dashed loops** (islets that form one land area): dashes dilated 6 px, pockets of sea they enclose, islets
  whose 10–20 px ring is mostly inside a pocket. Ten groups.
- **Arrows**: thin dark strokes on the sea, 22–170 px long, each end marched along the stroke's axis to the
  first land area or dashed pocket. 21 found strictly; 36 in the labels file (15 read by eye, marked
  `"source": "eye"`).
- **The R&D table**: 32 rectangular cells found, lattice fitted to 5 columns × 7 rows (3 cells are cut by a
  sea line).

## Counts

| thing | count |
|---|---|
| provinces | 26 (D5) |
| land regions on the print | 151 |
| land areas after joining dashed groups | 127, of which 116 coastal |
| sea areas | 31 |
| land–land adjacencies (shared border or arrow) | 204 |
| sea–sea adjacencies | 59 |
| land–sea contacts | 159 |
| arrows | 36 |
| islet groups | 10 |

## Please check (the things I could not settle from the print)

1. **Province of the off-shore island groups.** I put the Nias/Mentawai loop (areas 31, 47, 54) in
   **Sumatera Utara** (its arrow comes from Sumatera Utara's area 13) and the southern Mentawai loop (90, 98,
   103) in **Sumatera Barat**; Bangka (97) in **Sumatera Selatan** (named beside it) although its arrow comes
   from Jambi; the Banggai islet (51) in **Sulawesi Tengah**; the Sula islands (85, 87) in **Maluku**; the
   Kei/Aru/Tanimbar loops in **Maluku**; Raja Ampat and Biak loops in **Papua**. The deeds' little maps agree
   where they show these (the Maluku spice deed highlights Buru, Seram and the Kei/Tanimbar groups).
2. **Arrows read by eye** (orange on the check render): Sumatera Utara→Nias (13–31), the Mentawai chain
   (54–69, 69–90, 90–64), Jawa Timur→Madura (146–149), Lombok–Sumbawa (170–175), Flores–Solor (163–171),
   Solor–Timor (171–174), Sulawesi Utara→Banggai→Sulawesi Tengah (40–51, 51–62), Sulawesi Tenggara (113–128),
   Sula–Buru (85–87, 87–109), the Halmahera chain (42–58, 58–76, 76–67). If any arrow on the board is missing
   from the render, or one is drawn that is not printed, tell me which.
3. **Flores east tip**: the Solor arrow lands on the eastern tip of Flores; I attached it to area 163 (the
   tip), not 172.
4. **Raja Ampat** is one dashed loop on the print containing four islets (52, 53, 73, 86); the arrow to the
   mainland lands near area 65.

Everything else (every land area, every sea area, the coastline contacts) came from the print without
interpretation.
