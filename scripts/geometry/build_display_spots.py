#!/usr/bin/env python3
"""Where each city's goods display stands (C7): for every coastal land area (P1.7, where a city may be built) and every
city size, the display's point sits just off the city ring and the display lies along a direction chosen so it covers
as little of the busy board as it can.

Input : src/geometry/map.ts (areas, ship slots, start-marker spots, the shown board), src/geometry/tracks.ts,
        src/geometry/cityDisplays.ts (the displays' outlines), art/build/regions.json (the printed logo),
        art/board_diffuse.png (for the check renders only)
Output: src/geometry/displaySpots.ts, art/build/display_spots.png and display_spots_one.png to check by eye

Cost, per board pixel the display (and a margin for its shadow and the goods stacked on it) covers:
  - off the shown board, on the R&D table or the logo: not allowed;
  - another area's pole (where its goods marker or city stands) or this city's ring: very high;
  - a ship's place in a sea: moderate for the first two ships of the sea, less for the later ones (seas rarely hold
    many);
  - a province's company start markers (only until its companies are started): moderate;
  - another province's land (its printed area lines and icons): low; the city's own province lower, its own area
    lower still; open sea: free.
Plus a small cost for lying up or down the board rather than across it (the rulebook draws them across), and for
standing further from the ring than it must. Each size is placed on its own: a display changes size only while it is
inside its city (P7.3), so the next size can come out somewhere else.
"""
import sys, site, os, json, re, math
sys.path.append(site.getusersitepackages())
import cv2, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEO = os.path.join(ROOT, 'src', 'geometry')
BUILD = os.path.join(ROOT, 'art', 'build')

DISPLAY_H = 78            # px: GOODS_DISPLAY_H (0.78 world units) at BOARD_PX_PER_UNIT 100
RING_R = 27               # px: CITY_RING_DIAMETER / 2
GAPS = [RING_R + 6, RING_R + 14, RING_R + 24, RING_R + 36]   # the point's distance from the city's centre, px
ANGLES = range(0, 360, 5)
MARGIN = 6                # px round the outline: the display's shadow and the goods stacked on it


def ts_const(path, name):
    """The JSON value of `export const NAME ... = <json>;` on one line of a generated file."""
    for line in open(path):
        if line.startswith(f'export const {name}'):
            return json.loads(line.split('= ', 1)[1].rstrip().rstrip(';'))
    raise SystemExit(f'{name} not found in {path}')


def ts_array(path, name):
    """The records of `export const NAME: T[] = [` ... `];`, one JSON object per line."""
    out, inside = [], False
    for line in open(path):
        if line.startswith(f'export const {name}'): inside = True; continue
        if inside:
            if line.startswith('];'): return out
            out.append(json.loads(line.strip().rstrip(',')))
    raise SystemExit(f'{name} not found in {path}')


MAP_TS = os.path.join(GEO, 'map.ts')
lands = ts_array(MAP_TS, 'LAND_AREAS')
seas = ts_array(MAP_TS, 'SEA_AREAS')
start_spots = ts_const(MAP_TS, 'PROVINCE_MARKER_SPOT')
crop = ts_const(MAP_TS, 'CROP_RECT')
mp = re.search(r'MAP_PX = \{ w: (\d+), h: (\d+) \}', open(MAP_TS).read())
W, H = int(mp.group(1)), int(mp.group(2))
tracks = ts_const(os.path.join(GEO, 'tracks.ts'), 'TRACKS_RECT')
displays = ts_const(os.path.join(GEO, 'cityDisplays.ts'), 'CITY_DISPLAYS')
regions = json.load(open(os.path.join(BUILD, 'regions.json')))

# ---------------------------------------------------------------- the cost of covering each board pixel
INF = 1e6
cost = np.zeros((H, W), np.float32)
land = np.zeros((H, W), np.uint8)
for a in lands:
    for ring in a['rings']: cv2.fillPoly(land, [np.array(ring, np.int32)], 1)
cost[land > 0] = 3.0
for s in seas:
    for k, (x, y) in enumerate(s['slots']):
        # a ship's block: the ship 30 px below the block's top, its capacity markers below it (build_map.py)
        w = [12, 8, 4, 2, 2, 2][min(k, 5)]
        x0, y0 = int(x - 58), int(y - 30)
        cost[max(0, y0):y0 + 110, max(0, x0):x0 + 116] += w
for (sx, sy) in start_spots.values():
    blob = np.zeros((H, W), np.uint8)
    cv2.circle(blob, (int(sx), int(sy)), 40, 1, -1)
    cv2.circle(blob, (int(sx) + 80, int(sy)), 40, 1, -1)    # a province's second marker stands to the right
    cost[blob > 0] += 6
poles = np.zeros((H, W), np.uint8)
for a in lands: cv2.circle(poles, tuple(int(v) for v in a['pole']), 36, 1, -1)
cost[poles > 0] += 60
cx0, cy0, cx1, cy1 = crop
forbidden = np.ones((H, W), np.uint8)
forbidden[cy0:cy1, cx0:cx1] = 0
tx0, ty0, tx1, ty1 = tracks
forbidden[ty0:ty1, tx0:tx1] = 1
logo = np.array(regions['logo'], np.int32)
cv2.fillPoly(forbidden, [cv2.convexHull(logo)], 1)
forbidden = cv2.dilate(forbidden, np.ones((11, 11), np.uint8))
cost[forbidden > 0] = INF


def outline(size, pole, gap, theta):
    """The display's outline in board pixels: its point `gap` from the pole along `theta` (radians, y up), the
    display lying along theta away from the city."""
    d = displays[str(size)]
    w = DISPLAY_H * d['aspect']
    tip = d['tip']
    c, s = math.cos(theta), math.sin(theta)
    px, py = pole[0] + gap * c, -pole[1] + gap * s        # the point, y up
    pts = []
    for (u, v) in d['points']:
        X, Y = (u - tip[0]) * w, (v - tip[1]) * DISPLAY_H
        pts.append([px + X * c - Y * s, -(py + X * s + Y * c)])
    return np.array(pts, np.float32)


def footprint_cost(size, pole, gap, theta, own):
    pts = outline(size, pole, gap, theta)
    x0, y0 = np.floor(pts.min(0)).astype(int) - MARGIN
    x1, y1 = np.ceil(pts.max(0)).astype(int) + MARGIN
    if x0 < 0 or y0 < 0 or x1 >= W or y1 >= H: return INF
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.fillPoly(m, [np.round(pts - [x0, y0]).astype(np.int32)], 1)
    m = cv2.dilate(m, np.ones((2 * MARGIN + 1, 2 * MARGIN + 1), np.uint8))
    win = cost[y0:y1, x0:x1]
    total = float(win[m > 0].sum())
    if total >= INF: return INF
    # the city's own province costs less than other land (its own area least), and its own pole is the ring the
    # point stands beside
    total -= 1.5 * float((own_province[y0:y1, x0:x1] & m).sum())
    total -= 0.9 * float((own[y0:y1, x0:x1] & m).sum())
    total -= 60 * float((own_pole[y0:y1, x0:x1] & m).sum())
    total += 0.35 * float(m.sum()) * abs(math.sin(theta))    # across the board rather than up or down it
    total += 40 * (gap - GAPS[0])                             # no further out than it must
    return total


spots = {}
coastal = [a for a in lands if a['coastal']]
province_mask = {}
for a in lands:
    pm = province_mask.setdefault(a['province'], np.zeros((H, W), np.uint8))
    for ring in a['rings']: cv2.fillPoly(pm, [np.array(ring, np.int32)], 1)
for a in coastal:
    own_province = province_mask[a['province']]
    own = np.zeros((H, W), np.uint8)
    for ring in a['rings']: cv2.fillPoly(own, [np.array(ring, np.int32)], 1)
    own_pole = np.zeros((H, W), np.uint8)
    cv2.circle(own_pole, tuple(int(v) for v in a['pole']), 36, 1, -1)
    per_size = []
    for size in (1, 2, 3):
        best = None
        for gap in GAPS:
            for deg in ANGLES:
                th = math.radians(deg)
                c = footprint_cost(size, a['pole'], gap, th, own)
                if best is None or c < best[0]: best = (c, gap, th)
        c, gap, th = best
        if c >= INF: raise SystemExit(f'no room for a size {size} display beside area {a["id"]} ({a["province"]})')
        tipx, tipy = a['pole'][0] + gap * math.cos(th), a['pole'][1] - gap * math.sin(th)
        per_size.append(dict(dx=round((tipx - a['pole'][0]) / 100, 3), dy=round((a['pole'][1] - tipy) / 100, 3), angle=round(th, 4), cost=round(c)))
    spots[a['id']] = per_size
    print(a['id'], a['province'], [(round(math.degrees(p['angle'])), p['cost']) for p in per_size])

lines = ['// Generated by scripts/geometry/build_display_spots.py. Do not edit: rerun the builder.',
         '/** Where each coastal area\'s city goods display stands, for a city of size 1, 2 and 3: its point, in world units',
         ' *  from the area\'s pole (the city ring), and the direction it lies away from the city (radians, y up). */',
         'export const DISPLAY_SPOTS: Record<number, { dx: number; dy: number; angle: number }[]> = ' +
         json.dumps({k: [dict(dx=p['dx'], dy=p['dy'], angle=p['angle']) for p in v] for k, v in spots.items()}, separators=(',', ':')) + ';']
open(os.path.join(GEO, 'displaySpots.ts'), 'w').write('\n'.join(lines) + '\n')
print('wrote src/geometry/displaySpots.ts for', len(spots), 'coastal areas')

# ---------------------------------------------------------------- check renders
tex = cv2.imread(os.path.join(ROOT, 'art', 'board_diffuse.png'))
off = regions['texture_offset']
board = tex[off[1]:off[1] + H, off[0]:off[0] + W].copy()
for s in seas:
    for k, (x, y) in enumerate(s['slots'][:2]):
        cv2.rectangle(board, (int(x - 58), int(y - 30)), (int(x + 58), int(y + 80)), (200, 120, 0), 2)
by_prov = {}
for a in coastal: by_prov.setdefault(a['province'], []).append(a)
palette = [(40, 40, 220), (40, 160, 40), (200, 40, 160), (0, 140, 255), (160, 0, 0), (0, 0, 0)]
full = board.copy()
for i, (prov, areas) in enumerate(sorted(by_prov.items())):
    col = palette[i % len(palette)]
    for a in areas:
        p = spots[a['id']][2]
        th = p['angle']
        gap = math.hypot(p['dx'], p['dy']) * 100
        pts = outline(3, a['pole'], gap, th).astype(np.int32)
        cv2.polylines(full, [pts], True, col, 2)
cv2.imwrite(os.path.join(BUILD, 'display_spots.png'), full)
# one city per province (its largest coastal area), all three sizes: what a game might show
one = board.copy()
for prov, areas in by_prov.items():
    a = max(areas, key=lambda r: r['area'])
    cv2.circle(one, tuple(int(v) for v in a['pole']), RING_R, (0, 160, 255), 3)
    for size, col in zip((1, 2, 3), [(0, 160, 255), (40, 180, 40), (40, 0, 160)]):
        p = spots[a['id']][size - 1]
        gap = math.hypot(p['dx'], p['dy']) * 100
        cv2.polylines(one, [outline(size, a['pole'], gap, p['angle']).astype(np.int32)], True, col, 2)
cv2.imwrite(os.path.join(BUILD, 'display_spots_one.png'), one)
print('wrote art/build/display_spots.png and display_spots_one.png')
