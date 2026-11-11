#!/usr/bin/env python3
"""The city goods displays (C7) as the rulebook draws them: rules.pdf page 2 shows the three in a row under their city
markers, amber (size 1, one circle), green (size 2) and red (size 3), each a lobed card with a point at one end that
points at its city, and a printed circle at the middle of each lobe where a set of delivered goods goes. For each this
writes
  - art/build/display_<size>.png: the printed face, turned so the point is on the left, opaque, 3x, tinted so its
    colour is its city ring's (CITY_COLOR in src/consts.ts: the rings are the DLC's second-edition colours, and the
    rulebook's amber is a dark ochre that read as another size beside them);
  - src/geometry/cityDisplays.ts: the outline (x, y in 0..1 of the bounding box, y up), the aspect ratio, the point
    and the lobe centres (same coordinates; the lobe nearest the point first), and the face and edge colours;
and ships the faces into src/assets/displays (the packer resizes them).
"""
import sys, site, os, json, re
sys.path.append(site.getusersitepackages())
import cv2, numpy as np
from PIL import Image
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUILD = os.path.join(ROOT, 'art', 'build')
m = re.search(r'export const CITY_COLOR[^=]*= \{ 1: "(#\w+)", 2: "(#\w+)", 3: "(#\w+)" \}', open(os.path.join(ROOT, 'src', 'consts.ts')).read())
if not m: raise SystemExit('CITY_COLOR not found in src/consts.ts')
RING = {size: np.array([int(m.group(size)[i:i + 2], 16) for i in (1, 3, 5)], float) for size in (1, 2, 3)}


def expect(what, got, want):
    if got != want: raise SystemExit(f'{what}: expected {want}, got {got}')


# the displays and their city markers are the only 761 x 184 image on page 2
row = [im.image for im in PdfReader(os.path.join(ROOT, 'rules.pdf')).pages[1].images if im.image.size == (761, 184)]
expect('display rows on page 2', len(row), 1)
rgba = np.array(row[0].convert('RGBA'))
alpha = rgba[:, :, 3]

# the three displays are the large components (the city markers above them are a third the size of the smallest)
n, lab, st, _ = cv2.connectedComponentsWithStats((alpha > 250).astype(np.uint8))
found = sorted([i for i in range(1, n) if st[i][4] > 5000], key=lambda i: st[i][0])
expect('displays', len(found), 3)

hexc = lambda v: '#%02x%02x%02x' % tuple(int(round(t)) for t in v)
shapes = {}
for size, i in zip((1, 2, 3), found):
    x, y, w, h = [int(v) for v in st[i][:4]]
    mask = (lab[y:y + h, x:x + w] == i).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    # turned half a turn, so the point is on the left and the lobes run away from it: the city is to the left
    mask = mask[::-1, ::-1]
    piece = rgba[y:y + h, x:x + w][::-1, ::-1].astype(float)
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 0.004 * w, True)[:, 0, :]
    points = [[round(px / w, 4), round(1 - py / h, 4)] for px, py in poly]

    # the point: the leftmost column of the outline, at its middle
    cols = np.nonzero(mask.any(0))[0]
    tip_rows = np.nonzero(mask[:, cols[0]])[0]
    tip = [round(cols[0] / w, 4), round(1 - tip_rows.mean() / h, 4)]
    # the lobes: where the outline is tallest, one per size, away from the point (the column heights peak at each
    # lobe's middle, where the rulebook prints its circle)
    heights = mask.sum(0).astype(float)
    heights = np.convolve(heights, np.ones(5) / 5, mode='same')
    peaks = [cx for cx in range(3, w - 3) if heights[cx] >= heights[cx - 3:cx + 4].max() and heights[cx] > 0.9 * heights.max()]
    # neighbouring columns of one flat-topped peak count once
    lobes_x = []
    for cx in peaks:
        if lobes_x and cx - lobes_x[-1][-1] <= 4: lobes_x[-1].append(cx)
        else: lobes_x.append([cx])
    lobes_x = [float(np.mean(g)) for g in lobes_x]
    expect(f'lobes of the size {size} display', len(lobes_x), size)
    mid = np.nonzero(mask.any(1))[0]
    cy = (mid[0] + mid[-1]) / 2
    lobes = [[round(lx / w, 4), round(1 - cy / h, 4)] for lx in lobes_x]

    # the face colour: the commonest colour of the card; the edge a darker shade of it
    inside = mask.astype(bool) & (piece[:, :, 3] > 250)
    rgb = piece[:, :, :3]
    q = (rgb[inside] // 8).astype(int)
    keys, counts = np.unique(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2], return_counts=True)
    face = rgb[inside][(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]) == keys[counts.argmax()]].mean(0)
    # opaque face: the print over the face colour (the cut follows the outline, so the corners never show), moved so
    # the card's colour becomes its ring's: each pixel keeps its difference from the card colour, so the speckles and
    # circles stay lighter marks on the card (scaling the channels instead turned the red card's pink speckles yellow)
    op = piece[:, :, 3:4] / 255
    img = RING[size] + (rgb * op + face * (1 - op) - face)
    face = RING[size]
    edge = face * 0.62
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((w * 3, h * 3), Image.LANCZOS).save(os.path.join(BUILD, f'display_{size}.png'))
    shapes[size] = dict(aspect=round(w / h, 4), face=hexc(face), edge=hexc(edge), tip=tip, lobes=lobes, points=points)
    print(f'size {size}: bbox {(w, h)}, {len(points)} points, tip {tip}, lobes {lobes}, face {hexc(face)}')

lines = ['// Generated by scripts/art/rulebook_displays.py from the city goods displays on rules.pdf page 2. Do not edit.',
         '/** Each city goods display as the rulebook draws it, turned so its point is on the left: its outline (x, y in',
         ' *  0..1 of its bounding box, y up), aspect ratio, point, lobe centres (the lobe nearest the point first) and',
         ' *  face and edge colours. */',
         'export const CITY_DISPLAYS: Record<1 | 2 | 3, { aspect: number; face: string; edge: string; tip: [number, number]; lobes: [number, number][]; points: [number, number][] }> = ' + json.dumps(shapes) + ';']
open(os.path.join(ROOT, 'src', 'geometry', 'cityDisplays.ts'), 'w').write('\n'.join(lines) + '\n')
print('wrote src/geometry/cityDisplays.ts')

# ship the faces
d = os.path.join(ROOT, 'src', 'assets', 'displays'); os.makedirs(d, exist_ok=True)
for f in os.listdir(d):
    if f != 'sprite.json': os.remove(os.path.join(d, f))
for size in (1, 2, 3):
    open(os.path.join(d, f'size{size}.png'), 'wb').write(open(os.path.join(BUILD, f'display_{size}.png'), 'rb').read())
json.dump({"default": {"maxWidth": 640, "format": "png", "palette": True}}, open(os.path.join(d, 'sprite.json'), 'w'), indent=2)
print('shipped 3 faces into src/assets/displays')
