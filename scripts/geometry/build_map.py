#!/usr/bin/env python3
"""Detect the Indonesia board's land areas, sea areas, provinces, arrows and islet groups from the board art.

Input : art/board_diffuse.png   the TTS DLC board diffuse (4096x4096; the printed board is its lower band)
        scripts/geometry/map_labels.json   hand identification written after looking at the renders:
            {"provinces": {"<name>": [region ids...]}, "overrides": {...}}
Output: art/build/regions.json, art/build/labels.npy, art/build/*.png renders for checking
        src/geometry/map.ts   when map_labels.json exists and every assertion passes

Method. Every printed line is darker than the paper around it, so a morphological black-hat (closing minus
image, 9 px) finds the thin brown area lines on dark and light land alike; thick black coast and province
outlines are caught by an absolute luma threshold; the blue sea lines and the soft blue coast glow by a hue
and saturation mask. The connected components of everything else are the regions. Land is warm paper
(r - b > 10), sea is grey-blue. Small land regions with no blue glow on their ring are the loops of the
script lettering and are dropped. Land-land adjacency through a black barrier is a province border, through
a brown one an area line within a province.
"""
import sys, site, json, os
sys.path.append(site.getusersitepackages())
import cv2, numpy as np
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art', 'board_diffuse.png')
OUT = os.path.join(ROOT, 'art', 'build')
LABELS = os.path.join(ROOT, 'scripts', 'geometry', 'map_labels.json')
os.makedirs(OUT, exist_ok=True)

def expect(what, got, want):
    if got != want:
        raise SystemExit(f'EXPECTED {want} {what}, found {got}')
    print(f'ok: {got} {what}')

tex = cv2.imread(SRC)
gray = cv2.cvtColor(tex, cv2.COLOR_BGR2GRAY)
rows = np.where(gray.mean(axis=1) > 60)[0]; Y0, Y1 = int(rows.min()), int(rows.max()) + 1
cols = np.where(gray[Y0:Y1].mean(axis=0) > 60)[0]; X0, X1 = int(cols.min()), int(cols.max()) + 1
img = tex[Y0:Y1, X0:X1]
H, W = img.shape[:2]
print(f'board band in texture: x {X0}..{X1}, y {Y0}..{Y1}  ({W}x{H})')

b, g, r = [img[:, :, i].astype(np.int16) for i in range(3)]
luma = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
hue, sat = hsv[:, :, 0].astype(np.int16), hsv[:, :, 1].astype(np.int16)

# --- barrier ---------------------------------------------------------------------------------------------
black = luma < 70                                                  # coast and province outlines, icons, text
blackhat = cv2.morphologyEx(luma, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
thin = blackhat > 26                                               # thin brown area lines, on any paper
# the paper's speckle and stains are dark too, but short: keep only components that run at least 30 px
tl, tn = ndi.label(thin, structure=np.ones((3, 3)))
if tn:
    sl_ = ndi.find_objects(tl)
    keep = np.zeros(tn + 1, bool)
    for k, sl in enumerate(sl_, start=1):
        if sl is None: continue
        h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        keep[k] = max(h_, w_) >= 30
    thin = keep[tl]
blue = (b - r > 20) & (sat > 35) & (hue > 85) & (hue < 130)       # sea lines (sat>150) and the coast glow
line = (b - r > 60) & (sat > 150) & (hue > 85) & (hue < 130)
line = ndi.binary_dilation(line, iterations=3)                    # sea lines stop a few px short of the glow
# the map rectangle inside the lighter paper frame
col_med = np.median(luma[H // 4: 3 * H // 4], axis=0)
row_med = np.median(luma[:, W // 4: 3 * W // 4], axis=1)
def inner(profile):
    n = len(profile); lo = 3; hi = n - 3
    while lo < n and profile[lo] > 178: lo += 1
    while hi > 0 and profile[hi - 1] > 178: hi -= 1
    return lo, hi
MX0, MX1 = inner(col_med); MY0, MY1 = inner(row_med)
for name, v in (('left', MX0), ('top', MY0), ('right', W - MX1), ('bottom', H - MY1)):
    if not 20 <= v <= 90:
        raise SystemExit(f'frame {name} measured {v} px, expected 20..90')
print(f'map rectangle inside the frame: x {MX0}..{MX1}, y {MY0}..{MY1}')
outside = np.ones((H, W), bool); outside[MY0 + 2:MY1 - 2, MX0 + 2:MX1 - 2] = False
barrier = ndi.binary_dilation(black | thin | blue | line | outside, iterations=1)
cv2.imwrite(os.path.join(OUT, 'barrier.png'), (barrier * 255).astype(np.uint8))

labels, n = ndi.label(~barrier)
sizes = ndi.sum(np.ones_like(labels), labels, index=np.arange(1, n + 1))

# --- regions ---------------------------------------------------------------------------------------------
MIN_AREA = 80                                                     # the smallest islets are ~15 px across
regions = {}
for lab in range(1, n + 1):
    a = int(sizes[lab - 1])
    if a < MIN_AREA:
        continue
    mask = labels == lab
    ys, xs = np.nonzero(mask)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    if bbox[0] <= 1 or bbox[1] <= 1 or bbox[2] >= W - 1 or bbox[3] >= H - 1:
        continue
    d2 = ndi.binary_dilation(mask, iterations=2)
    ring = ndi.binary_dilation(d2, iterations=5) & ~d2            # 3..7 px out: past the outline, on the glow
    glow = float(blue[ring].mean()) if ring.any() else 0.0
    sealine = float(line[ring].mean()) if ring.any() else 0.0     # a saturated sea line bounds this region
    fill = a / ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]))
    warm = float((r[mask] - b[mask]).mean())
    huemed = float(np.median(hue[mask]))
    lumamean = float(luma[mask].mean())
    touches_edge = bbox[0] <= MX0 + 3 or bbox[1] <= MY0 + 3 or bbox[2] >= MX1 - 3 or bbox[3] >= MY1 - 3
    sub = mask[bbox[1]:bbox[3], bbox[0]:bbox[2]]
    dt = ndi.distance_transform_edt(np.pad(sub, 1))[1:-1, 1:-1]
    py, px = np.unravel_index(int(dt.argmax()), dt.shape)
    regions[lab] = dict(label=lab, area=a, bbox=bbox, cx=float(xs.mean()), cy=float(ys.mean()),
                        pole=[int(px + bbox[0]), int(py + bbox[1])], depth=float(dt.max()),
                        glow=glow, fill=fill, warm=warm, hue=huemed, luma=lumamean, sealine=sealine, edge=touches_edge)

dropped = []; cells = []; allregions = dict(regions)
for lab, rg in list(regions.items()):
    x0, y0, x1, y1 = rg['bbox']
    why = None
    if rg['fill'] > 0.9 and 3000 < rg['area'] < 30000: why = 'table cell'; cells.append(rg)
    elif x0 > W * 0.78 and y1 < H * 0.3: why = 'logo'
    else:
        # sea paper is blue-grey (hue 85..130); white land paper is warm (hue ~13) but nearly as grey, so a
        # region bounded by a saturated sea line or reaching the map's edge is sea too
        # sea paper is blue-grey (hue 85..130) and never lighter than ~205; white paper land (hue ~13, or a faint
        # blue tint on the smallest islets) is lighter than 208
        is_sea = ((85 <= rg['hue'] <= 130) and rg['luma'] < 208) or rg['edge']
        rg['kind'] = 'sea' if is_sea else 'land'
        if rg['kind'] == 'land' and rg['area'] < 1500 and rg['glow'] < 0.08: why = 'lettering loop on land'
        if rg['kind'] == 'land' and rg['area'] < 350 and rg['glow'] < 0.2: why = 'speck on land'
        if rg['kind'] == 'sea' and rg['area'] < 3000: why = 'lettering loop or sliver on sea'
    if why:
        dropped.append((lab, why, rg['area'])); del regions[lab]
print('dropped', len(dropped), 'small regions:', sorted(set(w for _, w, _ in dropped)))
for lab, why, a in dropped:
    rg = allregions[lab]
    if a >= 300 and rg['glow'] > 0.1 and 'table' not in why and why != 'logo':
        print(f"   dropped {why}: area {a} pole {rg['pole']} hue {rg['hue']:.0f} glow {rg['glow']:.2f} sealine {rg['sealine']:.3f} edge {rg['edge']}")
# the printed logo (dropped as 'logo'): the oval with its ornament as one filled shape. The shown board paints it
# out with sea paper (scripts/art/extract_tts.py reads its outline from regions.json) and its pixels join the sea
# round it, so the sea's outline has no notch where it was
logo_mask = np.zeros((H, W), bool)
logo_outline = []
for lab, why, _ in dropped:
    if why != 'logo': continue
    x0, y0, x1, y1 = allregions[lab]['bbox']
    lx0, ly0, lx1, ly1 = max(0, x0 - 45), max(0, y0 - 45), min(W, x1 + 45), min(H, y1 + 45)
    part = (labels[ly0:ly1, lx0:lx1] == lab) | (black | thin)[ly0:ly1, lx0:lx1]   # its paper and its ink
    ys, xs = np.nonzero(part)
    hull = cv2.convexHull(np.stack([xs + lx0, ys + ly0], 1).astype(np.int32))
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [hull], 1)
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    logo_mask |= m.astype(bool)
if logo_mask.any():
    cs, _ = cv2.findContours(logo_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    logo_outline = cv2.approxPolyDP(max(cs, key=cv2.contourArea), 1.5, True)[:, 0, :].tolist()
    ys, xs = np.nonzero(logo_mask)
    print(f'logo: {len(logo_outline)}-point outline, box {[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}')

# the table lattice: 5 columns x 7 rows (Turn Order, then six R&D rows); three cells are cut by a sea line, so
# fit the lattice to the cells found and generate all 35
def cluster(vals, gap=20):
    vals = sorted(vals); out = [[vals[0]]]
    for v in vals[1:]:
        (out[-1] if v - out[-1][-1] < gap else out.append([v]) or out[-1]).append(v)
    return [int(round(np.median(c))) for c in out]
cx0 = cluster([c['bbox'][0] for c in cells]); cx1 = cluster([c['bbox'][2] for c in cells])
cy0 = cluster([c['bbox'][1] for c in cells]); cy1 = cluster([c['bbox'][3] for c in cells])
expect('table columns', len(cx0), 5); expect('table rows', len(cy0), 7)
TABLE_ROWS = ['turnOrder', 'bid', 'slots', 'mergers', 'expansion', 'hullPlayer', 'hullCompany']
table = [dict(row=TABLE_ROWS[j], step=i + 1, bbox=[cx0[i], cy0[j], cx1[i], cy1[j]]) for j in range(7) for i in range(5)]
print('table cells found', len(cells), '-> lattice', len(table))
print('regions:', len(regions), 'land', sum(r['kind'] == 'land' for r in regions.values()),
      'sea', sum(r['kind'] == 'sea' for r in regions.values()))

# --- adjacency: every barrier pixel belongs to its nearest kept region; regions whose cells touch are adjacent ---
ids = sorted(regions)
kept = np.zeros(n + 1, np.int32)
for lab in ids: kept[lab] = lab
owner = kept[labels]                                              # 0 everywhere that is barrier or dropped
_, (iy, ix) = ndi.distance_transform_edt(owner == 0, return_indices=True)
nearest = owner[iy, ix]
luma_min = ndi.minimum_filter(luma, size=3)                       # the line's core, wherever the cell border falls
pairs = {}
for dy, dx in ((0, 1), (1, 0)):
    a = nearest[:H - dy, :W - dx]; c = nearest[dy:, dx:]
    diff = (a != c) & (a > 0) & (c > 0)
    ys, xs = np.nonzero(diff)
    lo = np.minimum(a[ys, xs], c[ys, xs]); hi = np.maximum(a[ys, xs], c[ys, xs])
    for k in range(len(ys)):
        key = (int(lo[k]), int(hi[k]))
        pairs.setdefault(key, []).append(luma_min[ys[k], xs[k]])
adj = []
for (a, c), lum in pairs.items():
    if len(lum) < 8:
        continue
    lum = np.array(lum)
    adj.append(dict(a=a, b=c, pixels=len(lum), luma=float(np.median(lum)), black=float((lum < 70).mean())))
print('adjacent pairs', len(adj))
ll = [p['luma'] for p in adj if regions[p['a']]['kind'] == 'land' and regions[p['b']]['kind'] == 'land']
print('land-land barrier luma histogram:', np.histogram(ll, bins=[0, 40, 50, 60, 70, 80, 90, 100, 120, 255])[0].tolist())
lb = [p['black'] for p in adj if regions[p['a']]['kind'] == 'land' and regions[p['b']]['kind'] == 'land']
print('land-land black fraction histogram:', np.histogram(lb, bins=[0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1.01])[0].tolist())
np.save(os.path.join(OUT, 'nearest.npy'), nearest)

# --- arrows: dark thin strokes lying on the sea, each end pointing at a land region --------------------------
seamask = np.zeros((H, W), bool)
for lab in ids:
    if regions[lab]['kind'] == 'sea': seamask |= labels == lab
seaband = ndi.binary_dilation(seamask, iterations=12)
landmask = np.zeros((H, W), bool)
for lab in ids:
    if regions[lab]['kind'] == 'land': landmask |= labels == lab
land_dist, land_idx = ndi.distance_transform_edt(~landmask, return_indices=True)
# ink for arrows and dashes: black-hat > 60 keeps dashes, arrows and lettering and drops the paper grain; the
# saturated sea lines are dark enough to register too, so their core is cut out and the small gap it leaves
# in an arrow that crosses one is closed again
line_core = ndi.binary_dilation((b - r > 60) & (sat > 150) & (hue > 85) & (hue < 130), iterations=1)
ink = (black | (blackhat > 45)) & ~line_core
strokes = ndi.binary_closing(ink & (land_dist > 4), iterations=3)
sl, sn = ndi.label(ndi.binary_dilation(strokes, iterations=1))
# --- dashed loops: dashes closed up enclose several islets that form one land area ---------------------------
dashes = (black | (blackhat > 60)) & ~line_core & (land_dist > 3)
closed = ndi.binary_dilation(dashes, iterations=6)               # a closing erodes the bridge between dots away
solid = closed | landmask
pockets = ndi.binary_fill_holes(solid) & ~solid                   # sea enclosed by dashes (and coast)
pl, pn = ndi.label(pockets)
print('pockets >= 1500 px:', sorted([int(a) for a in ndi.sum(pockets, pl, range(1, pn + 1)) if a >= 1500])[:40])
cv2.imwrite(os.path.join(OUT, 'dbg_pockets.png'), cv2.resize(((pockets * 255) | (solid * 90)).astype(np.uint8), (1956, 929), interpolation=cv2.INTER_AREA))
if os.environ.get('DEBUG_MASKS'):
    for name, (cx, cy) in {'bali': (1740, 1440), 'sulteng': (2390, 735), 'riau': (880, 650), 'sultenggara': (2420, 1120), 'maluku': (2800, 1500)}.items():
        y0, y1, x0, x1 = cy - 160, cy + 160, cx - 160, cx + 160
        vis = img[y0:y1, x0:x1].copy()
        vis[strokes[y0:y1, x0:x1]] = (0, 0, 255)
        vis[closed[y0:y1, x0:x1] & ~strokes[y0:y1, x0:x1]] = (0, 200, 255)
        vis[pockets[y0:y1, x0:x1]] = (0.5 * vis[pockets[y0:y1, x0:x1]] + (0, 120, 0)).astype(np.uint8)
        cv2.imwrite(os.path.join(OUT, f'dbg_masks_{name}.png'), cv2.resize(vis, None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST))
groups = []
for k, sl_ in enumerate(ndi.find_objects(pl), start=1):
    if sl_ is None: continue
    m = pl == k
    a = int(m.sum())
    if a < 1500:
        continue
    members = []
    for lab in ids:
        rg = regions[lab]
        if rg['kind'] != 'land': continue
        x0, y0, x1, y1 = rg['bbox']
        if x1 < sl_[1].start - 10 or x0 > sl_[1].stop + 10 or y1 < sl_[0].start - 10 or y0 > sl_[0].stop + 10: continue
        body = labels == lab
        near = ndi.binary_dilation(body, iterations=10)           # the islet's own outline and glow sit inside 10 px
        ring = ndi.binary_dilation(near, iterations=10) & ~near   # 10..20 px out is open sea or the pocket
        if (ring & m).sum() > 0.4 * ring.sum():                   # an islet mostly surrounded by this pocket
            members.append(lab)
    if len(members) >= 2:
        groups.append(dict(members=members, area=a, pocket=k))
print('dashed groups', len(groups), [g['members'] for g in groups])

# --- arrow targets: land regions, and the pocket of each dashed group (an arrow often points at the loop) ----
target_id = np.where(landmask, labels, 0).astype(np.int64)
for gi, gp in enumerate(groups):
    target_id[pl == gp['pocket']] = -(gi + 1)
target_dist, target_idx = ndi.distance_transform_edt(target_id == 0, return_indices=True)
# --- arrows: thin dark strokes on the sea, each end near a target -------------------------------------------
arrows = []
DEBUG = os.environ.get('DEBUG_ARROWS')
objs = ndi.find_objects(sl)
for k, sl_ in enumerate(objs, start=1):
    if sl_ is None: continue
    y0, y1, x0, x1 = sl_[0].start, sl_[0].stop, sl_[1].start, sl_[1].stop
    m = sl[y0:y1, x0:x1] == k
    ys, xs = np.nonzero(m); xs = xs + x0; ys = ys + y0
    n_ = len(xs)
    def dbg(why):
        if DEBUG and abs((x0 + x1) / 2 - int(DEBUG.split(',')[0])) < 130 and abs((y0 + y1) / 2 - int(DEBUG.split(',')[1])) < 130:
            print(f'   stroke {k} bbox ({x0},{y0})-({x1},{y1}) n={n_}: {why}')
    if n_ < 60 or n_ > 2500:
        dbg('size'); continue
    pts = np.stack([xs, ys], 1).astype(np.float32)
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    length = float(s[0] / np.sqrt(n_) * 2 * 1.8)
    LOOSE = bool(os.environ.get('LOOSE_ARROWS'))
    if length < (15 if LOOSE else 22) or length > 170 or s[1] / s[0] > (0.85 if LOOSE else 0.75) or n_ / length > (20 if LOOSE else 14):
        dbg(f'shape length={length:.0f} s1/s0={s[1]/s[0]:.2f} n/len={n_/length:.1f}'); continue
    proj = (pts - c) @ vt[0]
    e1, e2 = pts[proj.argmin()], pts[proj.argmax()]
    mid = pts[np.abs(proj) < length * 0.15]
    if len(mid) == 0 or land_dist[mid[:, 1].astype(int), mid[:, 0].astype(int)].min() < 6:
        dbg('midpoint on land'); continue
    ends = []
    axis = vt[0] / (np.linalg.norm(vt[0]) + 1e-9)
    for e, sign in ((e1, -1), (e2, 1)):
        # march from the arrowhead outward along the arrow's own axis: the first target hit is what it points at
        hit = None
        for step in range(0, 50):
            x = int(round(e[0] + sign * axis[0] * step)); y = int(round(e[1] + sign * axis[1] * step))
            if 0 <= x < W and 0 <= y < H and target_id[y, x] != 0:
                hit = (float(step), int(target_id[y, x])); break
        if hit is None:
            x, y = int(e[0]), int(e[1])
            ty, tx = target_idx[:, y, x]
            hit = (float(target_dist[y, x]), int(target_id[ty, tx]))
        ends.append(hit)
    if all(d < (45 if LOOSE else 30) for d, _ in ends) and ends[0][1] != ends[1][1]:
        arrows.append(dict(a=ends[0][1], b=ends[1][1], from_=[int(e1[0]), int(e1[1])], to=[int(e2[0]), int(e2[1])], length=length))
        dbg(f'ARROW {ends}')
    else:
        dbg(f'ends {ends}')
# one arrow per pair (a faint shaft can split into two strokes)
seen = set(); uniq = []
for ar in arrows:
    key = tuple(sorted((ar['a'], ar['b'])))
    if key in seen: continue
    seen.add(key); uniq.append(ar)
arrows = uniq
print('arrows', len(arrows))

# --- polygons and render -----------------------------------------------------------------------------------
for lab, rg in regions.items():
    m = (labels == lab).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    rg['polygon'] = cv2.approxPolyDP(c, 1.5, True)[:, 0, :].tolist()

for i, lab in enumerate(ids):
    regions[lab]['id'] = i
    regions[lab]['key'] = f"{regions[lab]['pole'][0] // 10 * 10},{regions[lab]['pole'][1] // 10 * 10}"
lab2id = {lab: regions[lab]['id'] for lab in ids}
def endid(v):
    return lab2id[v] if v > 0 else dict(group=[lab2id[m] for m in groups[-v - 1]['members']])
# provinces: land regions joined through a brown (not black) barrier
PROVINCE_LINE_LUMA = 60
parent = {lab: lab for lab in ids}
def find(x):
    while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
    return x
for p in adj:
    if regions[p['a']]['kind'] == 'land' and regions[p['b']]['kind'] == 'land' and p['black'] < 0.5:
        parent[find(p['a'])] = find(p['b'])
clusters = {}
for lab in ids:
    if regions[lab]['kind'] == 'land': clusters.setdefault(find(lab), []).append(lab)
print('province clusters', len(clusters))
def render(kind, path, numbers=True):
    vis = img.copy()
    rng = np.random.default_rng(3)
    colour = {}
    for root, members in clusters.items():
        col = rng.integers(70, 255, 3)
        for lab in members: colour[lab] = col
    for lab in ids:
        rg = regions[lab]
        if rg['kind'] != kind: continue
        m = labels == lab; col = colour.get(lab, rng.integers(70, 255, 3))
        vis[m] = (0.4 * vis[m] + 0.6 * col).astype(np.uint8)
    for ar in arrows:
        cv2.line(vis, tuple(ar['from_']), tuple(ar['to']), (0, 0, 255), 3)
    for gp in groups:
        for v in gp['members']:
            p = regions[v]['pole']; cv2.circle(vis, (p[0], p[1]), 18, (255, 0, 255), 3)
    if numbers:
        for lab in ids:
            rg = regions[lab]
            if rg['kind'] != kind: continue
            p = (rg['pole'][0] - 12, rg['pole'][1] + 7)
            cv2.putText(vis, str(rg['id']), p, cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 4, cv2.LINE_AA)
            cv2.putText(vis, str(rg['id']), p, cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.imwrite(path, vis)
    for name, (x, y) in {'nw': (0, 0), 'n': (1300, 0), 'ne': (2600, 0), 'sw': (0, 900), 's': (1300, 900), 'se': (2600, 900)}.items():
        cv2.imwrite(path.replace('.png', f'_{name}.png'), vis[y:y + 950, x:x + 1400])
render('land', os.path.join(OUT, 'land.png'))
render('sea', os.path.join(OUT, 'sea.png'))
np.save(os.path.join(OUT, 'labels.npy'), labels)
out = dict(texture_offset=[X0, Y0], size=[W, H], map_rect=[MX0, MY0, MX1, MY1],
           regions=[regions[lab] for lab in ids],
           adjacency=[dict(a=lab2id[p['a']], b=lab2id[p['b']], pixels=p['pixels'], luma=p['luma']) for p in adj],
           arrows=[dict(a=endid(ar['a']), b=endid(ar['b']), from_=ar['from_'], to=ar['to']) for ar in arrows],
           groups=[dict(members=[lab2id[v] for v in gp['members']]) for gp in groups],
           provinces=[[lab2id[v] for v in members] for members in clusters.values()],
           table=table, logo=logo_outline)
json.dump(out, open(os.path.join(OUT, 'regions.json'), 'w'))
print('wrote', OUT)

# ============================================================================================================
# Hand labels -> src/geometry/map.ts
# ============================================================================================================
if not os.path.exists(LABELS):
    print('no map_labels.json yet: look at art/build/land.png and write it'); raise SystemExit(0)
L = json.load(open(LABELS))
byid = {regions[lab]['id']: regions[lab] for lab in ids}
# regions the detector takes for land that are open water closed off by arrows, sea lines and coasts
# (map_labels.json not_land): their pixels join the sea region round them, and their adjacency goes with them
from collections import Counter
for pid in L.get('not_land', []):
    if pid not in byid or byid[pid]['kind'] != 'land':
        raise SystemExit(f'not_land: region {pid} is not a land region')
    rg = byid.pop(pid); lab = rg['label']
    m = labels == lab
    near = ndi.binary_dilation(m, iterations=14) & ~m
    cnt = Counter(int(v) for v in labels[near] if v in regions and v != lab and regions[v]['kind'] == 'sea')
    if not cnt:
        raise SystemExit(f'not_land: region {pid} has no sea round it')
    # the sea it belongs to: named in map_labels.json not_land_into where the print says (a strait open to one sea
    # and closed off from another by a sea line), else the sea most of its edge touches
    into = L.get('not_land_into', {}).get(str(pid))
    best = byid[into]['label'] if into is not None else cnt.most_common(1)[0][0]
    labels[m] = best
    regions[best]['area'] += rg['area']
    for p in adj:
        if p['a'] == lab: p['a'] = best
        if p['b'] == lab: p['b'] = best
    ids.remove(lab); del regions[lab]
    print(f"not land: region {pid} folded into sea region {regions[best]['id']}")
# the logo's pixels (painted out on the shown board) join the sea round it
if logo_mask.any():
    near = ndi.binary_dilation(logo_mask, iterations=20) & ~logo_mask
    cnt = Counter(int(v) for v in labels[near] if v in regions and regions[v]['kind'] == 'sea')
    best = cnt.most_common(1)[0][0]
    labels[logo_mask] = best
    print(f"logo folded into sea region {regions[best]['id']}")
# squares of the printed Tracks grid (lower left; painted over with sea paper on the shown board) read as small
# seas with no coast: fold each into the sea round it, so no ship can sail into the Tracks
TRACKS_PX = (70, 1098, 660, 1795)
for sid in [i for i in list(byid) if byid[i]['kind'] == 'sea']:
    x0, y0, x1, y1 = byid[sid]['bbox']
    if not (x0 >= TRACKS_PX[0] and y0 >= TRACKS_PX[1] and x1 <= TRACKS_PX[2] and y1 <= TRACKS_PX[3]): continue
    rg = byid.pop(sid); lab = rg['label']
    m = labels == lab
    near = ndi.binary_dilation(m, iterations=14) & ~m
    cnt = Counter(int(v) for v in labels[near] if v in regions and v != lab and regions[v]['kind'] == 'sea'
                  and not (regions[v]['bbox'][0] >= TRACKS_PX[0] and regions[v]['bbox'][2] <= TRACKS_PX[2]
                           and regions[v]['bbox'][1] >= TRACKS_PX[1] and regions[v]['bbox'][3] <= TRACKS_PX[3]))
    if not cnt: raise SystemExit(f'tracks square {sid} has no real sea round it')
    best = cnt.most_common(1)[0][0]
    labels[m] = best
    regions[best]['area'] += rg['area']
    for p_ in adj:
        if p_['a'] == lab: p_['a'] = best
        if p_['b'] == lab: p_['b'] = best
    ids.remove(lab); del regions[lab]
    print(f"tracks square: sea region {sid} folded into sea region {regions[best]['id']}")
land_ids = sorted(byid[i]['id'] for i in byid if byid[i]['kind'] == 'land')
sea_ids = sorted(byid[i]['id'] for i in byid if byid[i]['kind'] == 'sea')
assigned = {}
for prov, members in L['provinces'].items():
    for m in members:
        if m not in byid or byid[m]['kind'] != 'land':
            raise SystemExit(f'{prov}: region {m} is not a land region')
        if m in assigned:
            raise SystemExit(f'region {m} is in both {assigned[m]} and {prov}')
        assigned[m] = prov
missing = [i for i in land_ids if i not in assigned]
if missing:
    raise SystemExit(f'land regions not assigned to a province: {missing} (poles {[byid[i]["pole"] for i in missing]})')
expect('provinces', len(L['provinces']), 26)
expect('land regions assigned', len(assigned), len(land_ids))

# groups: islets joined by a dashed outline become one land area, keyed by their first member
group_of = {}
for gp in L['groups']:
    provs = {assigned[m] for m in gp['members']}
    if len(provs) != 1:
        raise SystemExit(f"group {gp['name']} spans provinces {provs}")
    for m in gp['members']:
        if m in group_of: raise SystemExit(f'region {m} in two groups')
        group_of[m] = gp['members'][0]
area_of = lambda i: group_of.get(i, i)                              # region id -> land area id
area_ids = sorted({area_of(i) for i in land_ids})

# adjacency in area terms
adj_pairs = set()
for p in adj:
    a, c = lab2id[p['a']], lab2id[p['b']]
    ka, kc = byid[a]['kind'], byid[c]['kind']
    if ka == 'land': a = area_of(a)
    if kc == 'land': c = area_of(c)
    if a == c: continue
    adj_pairs.add((min(a, c), max(a, c), ka, kc))
land_land = sorted((a, c) for a, c, ka, kc in adj_pairs if ka == 'land' and kc == 'land')
sea_sea = sorted((a, c) for a, c, ka, kc in adj_pairs if ka == 'sea' and kc == 'sea')
land_sea = sorted(((a, c) if ka == 'land' else (c, a)) for a, c, ka, kc in adj_pairs if ka != kc)
arrow_pairs = []
for ar in L['arrows']:
    a, c = area_of(ar['a']), area_of(ar['b'])
    if ar['a'] not in assigned or ar['b'] not in assigned:
        raise SystemExit(f'arrow {ar} names a region that is not land')
    if a == c: raise SystemExit(f'arrow {ar} joins an area to itself')
    arrow_pairs.append((a, c, ar['source']))
for a, c, _ in arrow_pairs:
    if (min(a, c), max(a, c)) not in land_land:
        land_land.append((min(a, c), max(a, c)))
land_land.sort()
coast = {a for a, _ in land_sea}
print(f'areas: {len(area_ids)} land ({len(coast)} coastal), {len(sea_ids)} sea; adjacency land-land {len(land_land)}, sea-sea {len(sea_sea)}, coast {len(land_sea)}; arrows {len(arrow_pairs)}')
for prov, members in L['provinces'].items():
    areas = sorted({area_of(m) for m in members})
    if not any(a in coast for a in areas):
        raise SystemExit(f'{prov} has no coastal area: a city could never be built there')

# --- outlines: each area's printed shape, not the paper between its lines -------------------------------------
# A region is the paper inside the printed lines, so its edge sits half a line inside the print and traces every
# speck of stain that touches a line. For outlines only (adjacency and spots keep `labels`): every barrier pixel near
# an area goes to the nearest area, which puts each edge down the middle of its printed line and hands the specks
# back to the area they intrude on; then each area's mask is blurred and the strongest area wins every pixel, which
# closes the notches a few px wide that are left and rounds nothing a player would see.
OUTLINE_REACH = 14                                                # the coast's black line and glow are ~10 px wide
OUTLINE_SIGMA = 4.0
kept_labs = [byid[i]['label'] for i in land_ids + sea_ids]
is_kept = np.isin(labels, kept_labs)
dist_k, (iy_k, ix_k) = ndi.distance_transform_edt(~is_kept, return_indices=True)
nearest = np.where(dist_k <= OUTLINE_REACH, labels[iy_k, ix_k], 0)
# the blue glow off every coast is the sea's: land stops at the black coast line, the sea takes everything beyond it
sea_labs = [byid[i]['label'] for i in sea_ids]
is_sea = np.isin(labels, sea_labs)
dist_s, (iy_s, ix_s) = ndi.distance_transform_edt(~is_sea, return_indices=True)
# (as far as 60 px: a narrow inlet can be all glow, its open water beyond the loops of a sea's name)
glow_px = blue & ~black & ~is_kept & (dist_s <= 60)
nearest[glow_px] = labels[iy_s, ix_s][glow_px]
# and so is a pocket of sea dropped as lettering (inside the loops of a sea's name): it never goes to the land
sea_drop = np.isin(labels, [lab for lab, why, _ in dropped if why == 'lettering loop or sliver on sea'])
nearest[sea_drop] = labels[iy_s, ix_s][sea_drop]
nearest[~np.isin(nearest, kept_labs)] = 0
outline_labels = np.zeros((H, W), np.int32)
strength = np.full((H, W), 0.35, np.float32)                     # below this nobody claims the pixel (the frame)
pad = int(3 * OUTLINE_SIGMA) + 2
for lab in kept_labs:
    ys, xs = np.nonzero(nearest == lab)
    if not len(ys): continue
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
    blur = cv2.GaussianBlur((nearest[y0:y1, x0:x1] == lab).astype(np.float32), (0, 0), OUTLINE_SIGMA)
    win = blur > strength[y0:y1, x0:x1]
    strength[y0:y1, x0:x1][win] = blur[win]
    outline_labels[y0:y1, x0:x1][win] = lab

# polygons: keep enough points to draw a crisp outline at board scale
def ring(rg):
    m = (outline_labels == rg['label']).astype(np.uint8)
    if not m.any(): m = (labels == rg['label']).astype(np.uint8)  # an islet the blur swallowed keeps its paper
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    return cv2.approxPolyDP(c, 1.2, True)[:, 0, :].tolist()

def area_record(aid):
    members = [i for i in land_ids if area_of(i) == aid] if aid in group_of.values() else [aid]
    rings = [ring(byid[i]) for i in members]
    big = max(members, key=lambda i: byid[i]['area'])
    x0 = min(byid[i]['bbox'][0] for i in members); y0 = min(byid[i]['bbox'][1] for i in members)
    x1 = max(byid[i]['bbox'][2] for i in members); y1 = max(byid[i]['bbox'][3] for i in members)
    # a second spot inside the area for a start marker, clear of the pole where a city or goods marker stands: the
    # deepest point of the largest member once a 34-px disc round the pole is taken out (on an islet too small
    # for both, the deepest point left, however shallow)
    rg = byid[big]
    bx0, by0, bx1, by1 = rg['bbox']
    sub = (labels[by0:by1, bx0:bx1] == rg['label'])
    yy, xx = np.mgrid[by0:by1, bx0:bx1]
    px, py = rg['pole']
    away = sub & ((xx - px) ** 2 + (yy - py) ** 2 > 34 ** 2)
    dt = ndi.distance_transform_edt(np.pad(away, 1))[1:-1, 1:-1]
    sy, sx = np.unravel_index(int(dt.argmax()), dt.shape) if dt.max() > 0 else (py - by0, px - bx0 + 34)
    spot = [int(sx + bx0), int(sy + by0)]
    return dict(id=aid, province=assigned[aid], rings=rings, pole=rg['pole'], spot=spot, bbox=[x0, y0, x1, y1],
                area=sum(byid[i]['area'] for i in members), coastal=aid in coast)

GEN = os.path.join(ROOT, 'src', 'geometry')
os.makedirs(GEN, exist_ok=True)
lines = []
lines.append('// Generated by scripts/geometry/build_map.py from art/board_diffuse.png and scripts/geometry/map_labels.json.')
lines.append('// Do not edit: rerun the builder. Coordinates are pixels of the printed board band (MAP_PX), y down.')
lines.append('export type Px = [number, number];')
lines.append('export interface LandAreaGeom { id: number; province: string; rings: Px[][]; pole: Px; spot: Px; bbox: [number, number, number, number]; area: number; coastal: boolean }')
lines.append('export interface SeaAreaGeom { id: number; ring: Px[]; pole: Px; bbox: [number, number, number, number]; area: number; slots: Px[] }')
# --- the shown board: the land plus a margin (the paper frame and the empty ocean beyond are cropped) -----------
land_all = np.zeros((H, W), bool)
for i in land_ids: land_all |= labels == byid[i]['label']
ly, lx = np.nonzero(land_all)
CROP = [max(MX0, int(lx.min()) - 40), max(MY0, int(ly.min()) - 40), min(MX1, int(lx.max()) + 40), min(MY1, int(ly.max()) + 40)]
cx0, cy0, cx1, cy1 = CROP
print('shown board crop', CROP, f'({cx1 - cx0}x{cy1 - cy0} of {W}x{H})')
in_crop = np.zeros((H, W), bool); in_crop[cy0:cy1, cx0:cx1] = True

def clipped_sea(rg):
    """A sea area cut to the shown board: its ring, its deepest point (where ships stand) and box."""
    m = (labels == rg['label']) & in_crop
    if not m.any(): return None
    om = (outline_labels == rg['label']) & in_crop
    cs, _ = cv2.findContours((om if om.any() else m).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    ys, xs = np.nonzero(m)
    bb = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    sub = m[bb[1]:bb[3], bb[0]:bb[2]]
    dt = ndi.distance_transform_edt(np.pad(sub, 1))[1:-1, 1:-1]
    py, px = np.unravel_index(int(dt.argmax()), dt.shape)
    return dict(ring=cv2.approxPolyDP(c, 1.2, True)[:, 0, :].tolist(), pole=[int(px + bb[0]), int(py + bb[1])], bbox=bb, area=int(m.sum()))

# --- where each province's company start markers stand: in the sea just off the province, never on a land area ----
land_dist_all = ndi.distance_transform_edt(~land_all)
province_spot = {}
# a province's markers take its spot and the place to its right (two companies of one era): no other province's
# markers may overlap that pair (Lampung's and Jawa Barat's both look to the Sunda Strait)
SM_D = 72                                                         # START_MARKER_DIAMETER, px
SM_STEP = SM_D + 8                                                # the second marker's offset to the right, px
yy_sm, xx_sm = np.mgrid[0:H, 0:W]
sm_taken = np.zeros((H, W), bool)
for prov, members in L['provinces'].items():
    pm = np.zeros((H, W), bool)
    for m in members: pm |= labels == byid[m]['label']
    near = ndi.distance_transform_edt(~pm)
    # sea, clear of every coast by 26 px, within 90 px of this province, on the shown board
    ok = (~land_all) & (land_dist_all >= 26) & (near <= 90) & in_crop & ~sm_taken
    if not ok.any(): ok = (~land_all) & (land_dist_all >= 14) & (near <= 160) & in_crop & ~sm_taken
    if not ok.any(): raise SystemExit(f'no sea spot near {prov} for its start marker')
    # the point nearest the province's largest area
    big = max(members, key=lambda m: byid[m]['area'])
    bx, by = byid[big]['pole']
    ys, xs = np.nonzero(ok)
    k = int(np.argmin((xs - bx) ** 2 + (ys - by) ** 2))
    province_spot[prov] = [int(xs[k]), int(ys[k])]
    sx, sy = province_spot[prov]
    sm_taken |= (np.abs(yy_sm - sy) < SM_D + 6) & (np.abs(xx_sm - sx) < SM_D + SM_STEP + 6)
expect('start-marker spots', len(province_spot), 26)

# --- where each sea's ships stand: a place for each of up to six ships, packed on the sea's own water ------------
# A ship with its capacity markers takes a block 116 px wide and 110 px tall (two rows of markers, Hull 4-5) or 75 px
# (one row); the ship stands 30 px below the block's top edge (its sail leans up the screen), the markers below it.
SHIP_SLOT_BLOCKS = [(116, 110), (116, 75)]
SHIP_IN_BLOCK = 30                                                # ship centre below the block's top edge, px
SHIP_SLOTS = 6
sm_block = np.zeros((H, W), bool)
yy_all, xx_all = np.mgrid[0:H, 0:W]
for (sx, sy) in province_spot.values():
    # a start marker, and the second one that may stand to its right (Halmahera in era A)
    sm_block |= ((xx_all - sx) ** 2 + (yy_all - sy) ** 2 <= 45 ** 2) | ((abs(yy_all - sy) <= 45) & (xx_all >= sx) & (xx_all <= sx + 110))
def ship_slots(rg, fallback):
    """Where each ship of the sea stands, in order: the first as near the middle of the sea's coastline as a block
    fits (by the land the ships serve, not out in the emptiest water), each next one the nearest free block to the
    first, so the ships pack together on the sea's own water whatever its shape. Coast and start markers are kept
    clear; printed lettering doesn't matter. Where no block fits (a strait), the deepest free water."""
    m = ndi.binary_fill_holes(labels == rg['label']) & in_crop & ~land_all
    ys_m, xs_m = np.nonzero(m)
    if not len(ys_m): return [fallback]
    pad = 130
    x0, y0 = max(0, xs_m.min() - pad), max(0, ys_m.min() - pad)
    x1, y1 = min(W, xs_m.max() + pad), min(H, ys_m.max() + pad)
    sub = m[y0:y1, x0:x1]
    valid = sub & (land_dist_all[y0:y1, x0:x1] >= 14) & ~sm_block[y0:y1, x0:x1]
    coast = sub & (land_dist_all[y0:y1, x0:x1] < 40)
    if coast.any():
        cy, cx = [float(v.mean()) for v in np.nonzero(coast)]
    else:
        cx, cy = fallback[0] - x0, fallback[1] - y0
    free = valid.copy()                                           # clear water no block stands on yet
    occupied = np.zeros_like(sub)                                 # the blocks placed so far
    slots, first_narrow = [], None
    for k in range(SHIP_SLOTS):
        ref = (cx, cy) if not slots else (slots[0][0] - x0, slots[0][1] - y0)
        placed = None
        for bw, bh in SHIP_SLOT_BLOCKS:
            # cv2's rectangle erosion is fast where scipy's is not
            room = cv2.erode(free.astype(np.uint8), np.ones((bh, bw), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0
            if room.any():
                ys, xs = np.nonzero(room)
                i = int(np.argmin((xs - ref[0]) ** 2 + (ys - ref[1]) ** 2))
                placed = (int(xs[i]), int(ys[i]), bw, bh)
                break
        if placed is None:
            # a strait: the deepest water still free (on the sea's own water when the clear margin is used up)
            if first_narrow is None: first_narrow = k
            area = free if free.any() else sub & ~occupied if (sub & ~occupied).any() else sub
            # among the deepest free water (within 70% of the deepest), the point nearest the first ship: the
            # ships line up along the strait from there rather than gathering wherever it happens to widen
            dt = ndi.distance_transform_edt(np.pad(area, 1))[1:-1, 1:-1]
            ys, xs = np.nonzero(dt >= 0.7 * dt.max())
            i = int(np.argmin((xs - ref[0]) ** 2 + (ys - ref[1]) ** 2))
            yy, xx = int(ys[i]), int(xs[i])
            bw, bh = SHIP_SLOT_BLOCKS[-1]
            placed = (int(xx), int(yy), bw, bh)
        bx, by, bw, bh = placed
        block = (slice(max(0, by - bh // 2), by + bh // 2 + 1), slice(max(0, bx - bw // 2), bx + bw // 2 + 1))
        free[block] = False
        occupied[block] = True
        slots.append([int(bx + x0), int(by - bh // 2 + SHIP_IN_BLOCK + y0)])
    if first_narrow is not None:
        print(f"   sea {rg['id']}: room for {first_narrow} ship block(s); the rest stand in the deepest free water")
    return slots

lines.append(f'export const MAP_PX = {{ w: {W}, h: {H} }} as const;')
lines.append(f'/** the part of the board shown: the land plus a margin; world coordinates are centred on it */')
lines.append(f'export const CROP_RECT: [number, number, number, number] = {json.dumps(CROP)};')
lines.append(f'/** where each province\'s company start markers stand: in the sea just off the province */')
lines.append(f'export const PROVINCE_MARKER_SPOT: Record<string, Px> = {json.dumps(province_spot)};')
lines.append(f'export const MAP_RECT: [number, number, number, number] = [{MX0}, {MY0}, {MX1}, {MY1}];')
lines.append(f'export const TEXTURE_OFFSET: Px = [{X0}, {Y0}];')
lines.append('export const LAND_AREAS: LandAreaGeom[] = [')
for aid in area_ids:
    r = area_record(aid)
    lines.append(f'  {json.dumps(r, separators=(",", ":"))},')
lines.append('];')
lines.append('export const SEA_AREAS: SeaAreaGeom[] = [')
for sid in sea_ids:
    cs = clipped_sea(byid[sid])
    if cs is None: continue                  # wholly in the cropped-off ocean: no land touches it, nothing goes there
    cs['slots'] = ship_slots(byid[sid], cs['pole'])
    lines.append(f'  {json.dumps(dict(id=sid, **cs), separators=(",", ":"))},')
lines.append('];')
lines.append(f'export const LAND_ADJACENT: [number, number][] = {json.dumps(land_land)};')
lines.append(f'export const SEA_ADJACENT: [number, number][] = {json.dumps(sea_sea)};')
lines.append(f'export const COAST: [number, number][] = {json.dumps(land_sea)};  // [land, sea]')
lines.append(f'export const ARROWS: [number, number][] = {json.dumps([[a, c] for a, c, _ in arrow_pairs])};')
lines.append(f'export const ISLET_GROUPS: {{ name: string; areaId: number; members: number[] }}[] = {json.dumps([dict(name=g["name"], areaId=g["members"][0], members=g["members"]) for g in L["groups"]])};')
lines.append('export const TABLE_CELLS: { row: string; step: number; bbox: [number, number, number, number] }[] = [')
for c in table:
    lines.append(f'  {json.dumps(c, separators=(",", ":"))},')
lines.append('];')
open(os.path.join(GEN, 'map.ts'), 'w').write('\n'.join(lines) + '\n')
print('wrote', os.path.join(GEN, 'map.ts'))

# the check render: provinces coloured, arrows (green detected / orange eye), groups outlined, area ids
import colorsys
provs = list(L['provinces'])
vis = img.copy()
for k, prov in enumerate(provs):
    hcol = colorsys.hsv_to_rgb((k * 0.618034) % 1.0, 0.55, 0.95)
    col = np.array([hcol[2], hcol[1], hcol[0]]) * 255
    for m in L['provinces'][prov]:
        mk = labels == byid[m]['label']
        vis[mk] = (0.35 * vis[mk] + 0.65 * col).astype(np.uint8)
for gp in L['groups']:
    pts = np.concatenate([np.array(ring(byid[m])) for m in gp['members']])
    hull = cv2.convexHull(pts.astype(np.int32))
    cv2.polylines(vis, [hull], True, (255, 0, 255), 3)
for ar in L['arrows']:
    pa, pb = byid[ar['a']]['pole'], byid[ar['b']]['pole']
    col = (0, 200, 0) if ar['source'] == 'detected' else (0, 140, 255)
    cv2.line(vis, tuple(pa), tuple(pb), col, 4)
for i in land_ids:
    rg = byid[i]; p = (rg['pole'][0] - 12, rg['pole'][1] + 7)
    cv2.putText(vis, str(i), p, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.putText(vis, str(i), p, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1, cv2.LINE_AA)
for i in sea_ids:
    rg = byid[i]; p = (rg['pole'][0] - 12, rg['pole'][1] + 7)
    cv2.putText(vis, f'S{i}', p, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 4, cv2.LINE_AA)
    cv2.putText(vis, f'S{i}', p, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (120, 40, 0), 1, cv2.LINE_AA)
for k, prov in enumerate(provs):
    members = L['provinces'][prov]
    big = max(members, key=lambda m: byid[m]['area'])
    p = (byid[big]['pole'][0] - 60, byid[big]['pole'][1] - 20)
    cv2.putText(vis, prov, p, cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 5, cv2.LINE_AA)
    cv2.putText(vis, prov, p, cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2, cv2.LINE_AA)
cv2.imwrite(os.path.join(OUT, 'map_check.png'), vis)
for name, (x, y) in {'nw': (0, 0), 'n': (1300, 0), 'ne': (2600, 0), 'sw': (0, 900), 's': (1300, 900), 'se': (2600, 900)}.items():
    cv2.imwrite(os.path.join(OUT, f'map_check_{name}.png'), vis[y:y + 950, x:x + 1400])
print('wrote map_check.png')

# the outline check: every area's outline (as the game draws it when the area can be tapped) over the print
ov = img.copy()
for aid in area_ids:
    for rr in area_record(aid)['rings']:
        cv2.polylines(ov, [np.array(rr, np.int32)], True, (255, 0, 255), 1, cv2.LINE_AA)
for i in sea_ids:
    cr = clipped_sea(byid[i])
    if cr: cv2.polylines(ov, [np.array(cr['ring'], np.int32)], True, (0, 160, 255), 1, cv2.LINE_AA)
cv2.imwrite(os.path.join(OUT, 'outlines.png'), ov)
print('wrote outlines.png')
