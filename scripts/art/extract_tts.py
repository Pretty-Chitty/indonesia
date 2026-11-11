#!/usr/bin/env python3
"""Extract the Indonesia art from the Tabletop Simulator DLC bundle into art/ (not shipped), then cut and ship the
canonical set into src/assets/ (ship_art() below empties each sprite folder and copies only the manifest).

Sources: ~/Library/Tabletop Simulator/DLC/<id>.unity3d (the DLC bundle; its nested *.unity3d text assets hold
the board, player aid, markers) and the DLC save json (card sheet layout). Run: python3 -I scripts/art/extract_tts.py
"""
import sys, site, os, glob, json, io
sys.path.append(site.getusersitepackages())
import UnityPy, numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'art'); BUILD = os.path.join(ART, 'build'); os.makedirs(BUILD, exist_ok=True)
TTS = os.path.expanduser('~/Library/Tabletop Simulator/DLC')

def expect(what, got, want):
    if got != want: raise SystemExit(f'EXPECTED {want} {what}, found {got}')

# ---------------------------------------------------------------- 1. pull every texture out of the bundle(s)
def extract():
    bundles = glob.glob(os.path.join(TTS, '*.unity3d'))
    expect('DLC bundles', len(bundles), 1)
    env = UnityPy.load(bundles[0])
    tex = {}
    nested = {}
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            d = obj.read(); tex[d.m_Name] = d.image
        elif obj.type.name == 'TextAsset':
            d = obj.read(); s = d.m_Script
            nested[d.m_Name] = s.encode('utf-8', 'surrogateescape') if isinstance(s, str) else bytes(s)
    for name in ('indonesia_board', 'indonesia_player_aid', 'indonesia_game_box'):
        sub = UnityPy.load(io.BytesIO(nested[name]))
        for obj in sub.objects:
            if obj.type.name == 'Texture2D':
                d = obj.read(); tex[f'{name}/{d.m_Name}'] = d.image
    return tex

tex = extract()
def save(name, img):
    p = os.path.join(ART, name); os.makedirs(os.path.dirname(p), exist_ok=True); img.save(p); return p

board = tex['indonesia_board/Indonesia_Board_Diffuse']
expect('board texture size', board.size, (4096, 4096))
save('board_diffuse.png', board)
aid = tex['indonesia_player_aid/indonesia_player_aid_2048_diffuse']; save('player_aid.png', aid)
save('table.png', tex['indonesia_table_background'])
save('box.png', tex['indonesia_game_box/indonesia_game_box_diffuse_compressed'])
save('city_cards.png', tex['indonesia_city_cards_rescaled_2']); save('city_back.png', tex['indonesia_city_cards_back_rescaled_2'])
save('deeds_map.png', tex['indonesia_company_deeds_front_rescaled_2']); save('deeds_name.png', tex['indonesia_company_deeds_back_rescaled_2'])
for c in ('blue', 'purple', 'orange', 'red', 'yellow'):
    for t in (1, 2): save(f'ships/ship_{c}_{t}.png', tex[f'indonesia_ships_{c}_{t}'])
save('ships/ship_white_1.png', tex['indonesia_ships_white_1'])
for g in ('rice', 'spice', 'rubber', 'siap_faji', 'oil'): save(f'goods/counter_{g}.png', tex[f'indonesia_cardboard_goods_marker_{g}'])
for n in (1, 2, 3, 4): save(f'money/note_{n}.png', tex[f'indonesia_bills_stack_{n}'])
save('money/coin_1.png', tex['indonesia_coin_1_diffuse']); save('money/coin_5.png', tex['indonesia_coin_5_diffuse'])
print('extracted', len(tex), 'textures to', ART)

# ---------------------------------------------------------------- 2. cuts into art/build
def cvimg(pil): return cv2.cvtColor(np.array(pil.convert('RGB')), cv2.COLOR_RGB2BGR)

def olive_stain(bgr):
    cover = np.array(Image.open(os.path.join(ROOT, 'static', 'boxArt.jpg')).convert('RGB')).reshape(-1, 3).astype(float)
    olive = cover[cover.mean(1) < 70].mean(0)[::-1]                # BGR, about (26, 54, 60)
    lum = bgr.astype(float).mean(2, keepdims=True)
    return np.clip(olive * lum / lum.mean(), 0, 255).astype(np.uint8)

# the printed board band (same crop as scripts/geometry/build_map.py)
b = cvimg(board); gray = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
rows = np.where(gray.mean(axis=1) > 60)[0]; Y0, Y1 = int(rows.min()), int(rows.max()) + 1
cols = np.where(gray[Y0:Y1].mean(axis=0) > 60)[0]; X0, X1 = int(cols.min()), int(cols.max()) + 1
band = b[Y0:Y1, X0:X1]; expect('board band', band.shape[:2], (1858, 3912))
# --- the Turn Order track and R&D table become their own panel (LAYOUT.md): cut them out of the board ------------
# The printed table sits on open sea with two sea-area lines crossing it. On the board it is replaced by sea paper
# (low frequencies from the surrounding sea, grain from a clean sea patch) with the blue lines kept; on the panel
# art the blue lines and the bottom of the "Bengkulu" lettering are painted out the same way.
REGIONS = os.path.join(BUILD, 'regions.json')
if not os.path.exists(REGIONS): raise SystemExit('run scripts/geometry/build_map.py first (it measures the R&D table)')
table = json.load(open(REGIONS))['table']
expect('R&D table cells', len(table), 35)
tx0 = min(c['bbox'][0] for c in table); ty0 = min(c['bbox'][1] for c in table)
tx1 = max(c['bbox'][2] for c in table); ty1 = max(c['bbox'][3] for c in table)
expect('table lattice origin', (tx0, ty0), (80, 1136))
TRACKS_RECT = [tx0 - 10, ty0 - 38, tx1 + 148, ty1 + 8]          # titles above, row labels to the right
fb = band.astype(np.float32)
bb, gg, rr = [fb[:, :, i] for i in range(3)]
hsv_b = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
hue_b, sat_b = hsv_b[:, :, 0].astype(np.int16), hsv_b[:, :, 1].astype(np.int16)
blue_line = (bb - rr > 20) & (sat_b > 35) & (hue_b > 85) & (hue_b < 130)
blue_line = cv2.dilate(blue_line.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
lum = 0.299 * rr + 0.587 * gg + 0.114 * bb
ink = (cv2.morphologyEx(lum, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 18) | (lum < 120)

def grain_patch():
    # the cleanest 256-px sea patch south of Sumatra: no ink, no blue, least low-frequency variation
    best = None
    for y in range(1450, 1560, 16):
        for x in range(700, 1000, 16):
            win = (slice(y, y + 256), slice(x, x + 256))
            bad = ink[win].sum() + blue_line[win].sum()
            var = float(cv2.GaussianBlur(lum[win], (0, 0), 20).std())
            score = bad * 10 + var
            if best is None or score < best[0]: best = (score, x, y)
    _, x, y = best
    patch = fb[y:y + 256, x:x + 256]
    return patch - cv2.GaussianBlur(patch, (0, 0), 6)

GRAIN = grain_patch()

def paint_paper(img, fill, keep):
    """Replace `fill & ~keep` pixels of img (float BGR) with sea paper. Low frequencies: the surrounding paper is
    low-passed, shrunk 8x, the hole filled by inpainting at that scale (smooth, no texture to smear), grown back and
    blurred; grain is tiled from the clean sea patch (mirrored, so no seams)."""
    h, w = fill.shape
    valid = (~fill & ~ink & ~blue_line).astype(np.float32)
    wsum = cv2.GaussianBlur(valid, (0, 0), 6)
    lowp = cv2.GaussianBlur(img * valid[:, :, None], (0, 0), 6) / np.maximum(wsum, 1e-3)[:, :, None]
    k = 8
    small = cv2.resize(lowp, (w // k, h // k), interpolation=cv2.INTER_AREA)
    hole = cv2.resize(((wsum < 0.5) | fill).astype(np.uint8), (w // k, h // k), interpolation=cv2.INTER_NEAREST)
    hole = cv2.dilate(hole, np.ones((3, 3), np.uint8))
    filled = cv2.inpaint(np.clip(small, 0, 255).astype(np.uint8), hole, 12, cv2.INPAINT_TELEA).astype(np.float32)
    filled = cv2.GaussianBlur(filled, (0, 0), 3)
    low = cv2.resize(filled, (w, h), interpolation=cv2.INTER_CUBIC)
    low = cv2.GaussianBlur(low, (0, 0), 10)
    tile = np.concatenate([np.concatenate([GRAIN, GRAIN[:, ::-1]], 1), np.concatenate([GRAIN[::-1], GRAIN[::-1, ::-1]], 1)], 0)
    tiled = np.tile(tile, (h // 512 + 1, w // 512 + 1, 1))[:h, :w]
    out = img.copy()
    m = fill & ~keep
    out[m] = np.clip(low[m] + tiled[m], 0, 255)
    return out

# the blue sea lines proper: saturated, and not where black ink crosses them
line_core = (bb - rr > 45) & (sat_b > 110) & (hue_b > 85) & (hue_b < 130)
line_keep = cv2.dilate(line_core.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (lum > 110) & (bb - rr > 12)

# the board: the table area becomes sea, the blue lines stay
fill = np.zeros(lum.shape, bool)
fill[ty0 - 8:ty1 + 9, tx0 - 10:tx1 + 10] = True                      # cells and the R&D title
fill[ty0 - 38:ty0 - 6, tx0 - 10:tx0 + 125] = True                     # "Turn Order"
fill[ty0 + 129 + 10:ty1 + 9, tx1 + 5:tx1 + 150] = True               # row labels
# and the oval logo (outlined by build_map.py, which folds it into the sea): plain sea paper, nothing to keep
logo_outline = json.load(open(REGIONS)).get('logo') or []
if logo_outline:
    logo_fill = np.zeros(lum.shape, np.uint8)
    cv2.fillPoly(logo_fill, [np.array(logo_outline, np.int32)], 1)
    fill |= logo_fill.astype(bool)
band_painted = paint_paper(fb, fill, np.zeros_like(fill))
# lay the sea lines back over the new paper: each pixel's line opacity from its blueness (b - r: paper ~10, the
# line's core ~180), with gaps where table ink crossed the line closed by a grey closing along it
alpha = np.clip((bb - rr - 14) / 150.0, 0, 1) * (sat_b > 30)
alpha = cv2.morphologyEx(alpha.astype(np.float32), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
alpha *= cv2.dilate(line_core.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(np.float32)
core_px = fb[line_core & ~fill]
line_col = np.median(core_px, axis=0)
a = np.where(fill, alpha, 0)[:, :, None]
band_painted = (band_painted * (1 - a) + line_col[None, None, :] * a).astype(np.uint8)
print('sea line colour (BGR)', line_col.round().tolist())
# the shown board: the rectangle scripts/geometry/build_map.py chose (the land plus a margin), at 70% of the scan
import re as _re
_m = _re.search(r'CROP_RECT: \[number, number, number, number\] = \[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]', open(os.path.join(ROOT, 'src', 'geometry', 'map.ts')).read())
if not _m: raise SystemExit('src/geometry/map.ts has no CROP_RECT: run scripts/geometry/build_map.py first')
CX0, CY0, CX1, CY1 = map(int, _m.groups())
shown = band_painted[CY0:CY1, CX0:CX1]
cv2.imwrite(os.path.join(BUILD, 'board.jpg'), cv2.resize(shown, (int(shown.shape[1] * 0.7), int(shown.shape[0] * 0.7)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 88])
print('board cropped to', [CX0, CY0, CX1, CY1])
cv2.imwrite(os.path.join(BUILD, 'board_tracks_area_check.png'), band_painted[ty0 - 120:ty1 + 60, 0:tx1 + 260])
# the tracks panel: the same rectangle of the original print, blue lines and stray lettering painted out
x0, y0, x1, y1 = TRACKS_RECT
crop_fill = np.zeros(lum.shape, bool)
crop_fill[y0:y1, x0:x1] = blue_line[y0:y1, x0:x1]
crop_fill = cv2.dilate(crop_fill.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (lum > 95)   # keep the printed letters it crossed
stray = np.zeros(lum.shape, bool); stray[y0:ty0 - 2, tx1 - 40:x1] = True     # the bottom of "Bengkulu"
crop_fill |= cv2.dilate((stray & (ink | blue_line)).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
tracks = paint_paper(fb, crop_fill, np.zeros_like(crop_fill))[y0:y1, x0:x1].astype(np.uint8)
cv2.imwrite(os.path.join(BUILD, 'tracks.jpg'), tracks, [cv2.IMWRITE_JPEG_QUALITY, 88])
cv2.imwrite(os.path.join(BUILD, 'tracks_icon.jpg'), cv2.resize(band[ty0:ty0 + 84, tx0:tx0 + 172], (200, 98), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
os.makedirs(os.path.join(ROOT, 'src', 'geometry'), exist_ok=True)
open(os.path.join(ROOT, 'src', 'geometry', 'tracks.ts'), 'w').write(
    '// Generated by scripts/art/extract_tts.py: the board-band pixel rectangle cut out as the tracks panel. Do not edit.\n'
    f'export const TRACKS_RECT: [number, number, number, number] = {json.dumps(TRACKS_RECT)};\n')
print('tracks panel cut', TRACKS_RECT)
# the oval logo, for the board's panel tab (located on the band: the dark oval top right)
logo = band[120:470, 3360:3800]
cv2.imwrite(os.path.join(BUILD, 'logo.jpg'), cv2.resize(logo, (260, 207), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])

# card sheets: cells by the TTS CustomDeck layout (city 3x5, deeds 4x6); crop the mini-map on each face
city = cvimg(tex['indonesia_city_cards_rescaled_2']); CW, CH = city.shape[1] // 3, city.shape[0] // 5   # 1365 x 819
deeds = cvimg(tex['indonesia_company_deeds_front_rescaled_2']); DW, DH = deeds.shape[1] // 4, deeds.shape[0] // 6  # 1024 x 682
names = cvimg(tex['indonesia_company_deeds_back_rescaled_2'])

def frame_box(cell, pad=16):
    """The brown frame round a deed's mini-map: the darkest long horizontal and vertical runs."""
    g = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = g.shape
    # the frame is the dark rectangle in the upper part of the cell
    dark = g < 110
    rowsum = dark.sum(axis=1); colsum = dark[: int(h * 0.7)].sum(axis=0)
    ys = np.where(rowsum > w * 0.4)[0]; xs = np.where(colsum > h * 0.25)[0]
    if len(ys) < 2 or len(xs) < 2: return None
    return [int(xs.min()) + pad, int(ys.min()) + pad, int(xs.max()) - pad, int(ys.max()) - pad]

# every deed prints its map in the same frame; measure it on the light-panelled deeds (a dark oil panel fools the
# detector) and apply the median box to all 24
boxes = []
for i in range(24):
    r, c = divmod(i, 4); cell = deeds[r * DH:(r + 1) * DH, c * DW:(c + 1) * DW]
    fb = frame_box(cell)
    if fb and 250 < fb[3] - fb[1] < 360 and 780 < fb[2] - fb[0] < 900: boxes.append(fb)
# the frame lines sit at rows 93..98 and 409..414, cols 92..98 and 923..929 of every cell (measured on the rice and
# shipping deeds, whose panels are light); the dark oil and green spice panels fool the row test, so the box is fixed
# here and the light cells only confirm it
FB = [100, 101, 922, 407]
agree = [b for b in boxes if all(abs(b[k] - FB[k]) <= 14 for k in range(4))]
expect('light deed cells agreeing with the fixed map frame (of %d)' % len(boxes), len(agree) >= 3, True)
print('deed map frame', FB, 'confirmed on', len(agree), 'light cells')
deed_boxes = []
for i in range(24):
    r, c = divmod(i, 4); cell = deeds[r * DH:(r + 1) * DH, c * DW:(c + 1) * DW]
    x0, y0, x1, y1 = FB
    crop = cell[y0:y1, x0:x1]
    deed_boxes.append(dict(i=i, box=FB, size=[x1 - x0, y1 - y0]))
    cv2.imwrite(os.path.join(BUILD, f'deed_{i}.jpg'), cv2.resize(crop, (600, int(600 * crop.shape[0] / crop.shape[1])), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
sizes = {tuple(d['size']) for d in deed_boxes}
panel = {}
for i, kind in ((0, 'spice'), (5, 'rice'), (10, 'oil'), (14, 'rubber'), (18, 'shipping')):
    r, c = divmod(i, 4); cell = deeds[r * DH:(r + 1) * DH, c * DW:(c + 1) * DW]
    px = cell[DH - 60:DH - 20, 40:200].reshape(-1, 3)       # the panel below the map, left of the era letter
    bgr = np.median(px, axis=0); panel[kind] = '#%02x%02x%02x' % (int(bgr[2]), int(bgr[1]), int(bgr[0]))
json.dump(panel, open(os.path.join(BUILD, 'deed_panels.json'), 'w'), indent=1)
print('deed panel colours', panel)
print('deed map frames', sorted(sizes))
# city cards carry no frame: the whole cell is paper with the map; trim the cell's dark margin
for i in range(15):
    r, c = divmod(i, 3); cell = city[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW]
    crop = cell[30:CH - 30, 30:CW - 30]
    cv2.imwrite(os.path.join(BUILD, f'city_{i}.jpg'), cv2.resize(crop, (600, int(600 * crop.shape[0] / crop.shape[1])), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
back = cvimg(tex['indonesia_city_cards_back_rescaled_2'])
cv2.imwrite(os.path.join(BUILD, 'card_back.jpg'), cv2.resize(back, (600, 300), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
# a clean paper patch for drawn faces: the player aid's lower half is blank paper
a_paper = cvimg(aid)
paper = a_paper[int(a_paper.shape[0] * 0.56):int(a_paper.shape[0] * 0.56) + 320, 120:440]
cv2.imwrite(os.path.join(BUILD, 'paper.jpg'), paper, [cv2.IMWRITE_JPEG_QUALITY, 85])

# goods icons from the player aid: black glyphs on paper along the bottom row (ship, transport, rice, spice,
# rubber, siap faji, oil). Locate them as dark components in the bottom band.
a = cvimg(aid); ah, aw = a.shape[:2]
# the aid occupies the top-left ~1440x1024 of the 2048 texture; the goods row is just under its half height
band_y0, band_y1 = int(ah * 0.426), int(ah * 0.475)   # below the "Rice 20" labels (bottom ~865), through the glyphs
strip = a[band_y0:band_y1, : int(aw * 0.71)]
g = cv2.cvtColor(strip, cv2.COLOR_BGR2GRAY)
dark = (g < 90).astype(np.uint8)
n, lab, stats, cent = cv2.connectedComponentsWithStats(dark, 8)
comps = [(stats[k, cv2.CC_STAT_LEFT], stats[k, cv2.CC_STAT_TOP], stats[k, cv2.CC_STAT_WIDTH], stats[k, cv2.CC_STAT_HEIGHT], stats[k, cv2.CC_STAT_AREA]) for k in range(1, n)]
comps = [c for c in comps if c[4] > 60]            # the ship's sail is thin lines: small components
comps.sort(key=lambda c: c[0])
# an icon is every dark component within one column (the ship is a hull plus thin sail lines; the transport
# icon is a ship inside a disc): merge components that overlap or nearly touch in x
merged = []
for c in comps:
    if merged and c[0] < merged[-1][0] + merged[-1][2] + 14:
        m = merged[-1]; x0 = min(m[0], c[0]); y0 = min(m[1], c[1]); x1 = max(m[0] + m[2], c[0] + c[2]); y1 = max(m[1] + m[3], c[1] + c[3])
        merged[-1] = (x0, y0, x1 - x0, y1 - y0, m[4] + c[4])
    else: merged.append(c)
expect('goods icons on the player aid', len(merged), 7)
ICON_NAMES = ['ship', 'transport', 'rice', 'spice', 'rubber', 'siapsaji', 'oil']
icon_paper = np.median(strip[5:25, 5:25].reshape(-1, 3), axis=0)
# The printed glyphs are tiny (the ship is 98 x 23 px), so each is traced rather than cut: the crop is enlarged 8x,
# smoothed past the paper's grain and the print's jagged edge, and its outline drawn solid black with a one-pixel
# soft edge on a clear background (opacity from darkness alone left the grain as a grey box round every glyph).
ICON_SCALE = 8
ICON_INK = 105                                       # grey level of the traced edge: ink ~30, paper ~150
for name, (x, y, w, h, area) in zip(ICON_NAMES, merged):
    pad = 6
    crop = strip[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad]
    gg = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    big = cv2.resize(gg, (gg.shape[1] * ICON_SCALE, gg.shape[0] * ICON_SCALE), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), ICON_SCALE * 0.55)
    alpha = np.clip((ICON_INK + 6 - big) / 12, 0, 1)                 # the edge: 12 grey levels wide, ~1 px
    side = max(alpha.shape) + 2 * pad * ICON_SCALE
    canvas = np.zeros((side, side), np.float32)
    oy = (side - alpha.shape[0]) // 2; ox = (side - alpha.shape[1]) // 2
    canvas[oy:oy + alpha.shape[0], ox:ox + alpha.shape[1]] = alpha
    small = cv2.resize(canvas, (400, 400), interpolation=cv2.INTER_AREA)
    rgba = np.dstack([np.zeros((400, 400), np.uint8)] * 3 + [(small * 255).round().astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(os.path.join(BUILD, f'icon_{name}.png'))
print('icons', [(n, m[2], m[3]) for n, m in zip(ICON_NAMES, merged)])

# ships: the texture's top half is the face (face-up on the table), the bottom half the back
for f in glob.glob(os.path.join(ART, 'ships', '*.png')):
    im = cvimg(Image.open(f)); h = im.shape[0]
    name = os.path.splitext(os.path.basename(f))[0]
    cv2.imwrite(os.path.join(BUILD, f'{name}_face.jpg'), cv2.resize(im[:h // 2], (400, 200), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
    cv2.imwrite(os.path.join(BUILD, f'{name}_back.jpg'), cv2.resize(im[h // 2:], (400, 200), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
# delivered-goods counters: each texture holds a plain face and a "2" face on a flat grey (128) background; the
# plain face is the larger non-grey component. Crop it 4 px inside its box.
for f in glob.glob(os.path.join(ART, 'goods', 'counter_*.png')):
    pil = Image.open(f).convert('RGBA'); rgba = np.array(pil); im = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR); h, w = im.shape[:2]
    name = os.path.splitext(os.path.basename(f))[0].replace('siap_faji', 'siapsaji')
    bg = im[2, 2].astype(np.int16)                      # the flat background (grey 123 or white), sampled at the corner
    diff = np.abs(im.astype(np.int16) - bg).max(axis=2) > 10
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_OPEN, np.ones((21, 21), np.uint8))   # cut the glow bridge
    n, lab, stats, _ = cv2.connectedComponentsWithStats(diff, 4)
    comps = sorted([stats[k] for k in range(1, n)], key=lambda st: -st[cv2.CC_STAT_AREA])
    if not comps: raise SystemExit(f'{name}: no counter face found')
    x, y, cw, chh, _ = comps[0]
    if cw > 1.4 * chh:                                   # the two faces merged through their glow: the plain one is left
        cw = int(chh)
    if len(comps) < 2 and cw <= 1.4 * chh and cw < 0.3 * w: raise SystemExit(f'{name}: counter face too small')
    face = im[y + 4:y + chh - 4, x + 4:x + cw - 4]
    cv2.imwrite(os.path.join(BUILD, f'{name}.jpg'), cv2.resize(face, (160, 160), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
# the table: a seamless patch of the DLC table wood, stained the box's olive (static/boxArt.jpg: the cover's dark
# ground, sampled as every pixel darker than 70) with the wood's own grain as the light and shade
t = cvimg(tex['indonesia_table_background']); patch = t[200:712, 200:1224]
cv2.imwrite(os.path.join(BUILD, 'table.jpg'), olive_stain(patch), [cv2.IMWRITE_JPEG_QUALITY, 85])
# the player aid's front, cropped to the sheet: each player's money mat (its Bank and Cash boxes hold the amounts)
aid_front = a[7:1022, 21:1443]
# just its two money boxes, the printed "Bank" (left column) and "Cash" (right column) with the paper below them
cv2.imwrite(os.path.join(BUILD, 'aid_bank.jpg'), cv2.resize(aid_front[0:420, 0:520], (400, 323), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite(os.path.join(BUILD, 'aid_cash.jpg'), cv2.resize(aid_front[0:420, 901:1421], (400, 323), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 86])
# the player aid, whole, for the dropdown art
cv2.imwrite(os.path.join(BUILD, 'player_aid.jpg'), cv2.resize(a, (1024, 1024), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
# the 10/50/100/500 notes for the aid and tutorial (top half of each stack texture)
for n in (1, 2, 3, 4):
    im = cvimg(tex[f'indonesia_bills_stack_{n}']); cv2.imwrite(os.path.join(BUILD, f'note_{n}.jpg'), cv2.resize(im[:512], (400, 200), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])

# a contact sheet of every cut on magenta, for checking
tiles = []
for f in sorted(glob.glob(os.path.join(BUILD, 'icon_*.png'))) + sorted(glob.glob(os.path.join(BUILD, 'counter_*.jpg'))) + sorted(glob.glob(os.path.join(BUILD, 'ship_orange_*.jpg'))) + [os.path.join(BUILD, 'deed_0.jpg'), os.path.join(BUILD, 'city_0.jpg'), os.path.join(BUILD, 'logo.jpg')]:
    im = Image.open(f).convert('RGBA'); im.thumbnail((240, 240))
    tile = Image.new('RGBA', (250, 250), (255, 0, 255, 255)); tile.paste(im, ((250 - im.width) // 2, (250 - im.height) // 2), im)
    tiles.append(tile)
sheet = Image.new('RGBA', (250 * 6, 250 * ((len(tiles) + 5) // 6)), (255, 0, 255, 255))
for k, tl in enumerate(tiles): sheet.paste(tl, ((k % 6) * 250, (k // 6) * 250))
sheet.save(os.path.join(BUILD, 'contact.png'))

# ---------------------------------------------------------------- 3. ship the manifest into src/assets
def ship_art():
    ASSETS = os.path.join(ROOT, 'src', 'assets')
    folders = {
        'board': ({'board.jpg': 'board.jpg'}, {"default": {"maxWidth": 2600, "format": "jpg"}}),
        'cards': ({**{f'deed{i}.jpg': f'deed_{i}.jpg' for i in range(24)}, **{f'city{i}.jpg': f'city_{i}.jpg' for i in range(15)}, 'cardback.jpg': 'card_back.jpg', 'paper.jpg': 'paper.jpg'},
                  {"default": {"maxWidth": 420, "format": "jpg"}}),
        'icons': ({f'{n}.png': f'icon_{n}.png' for n in ICON_NAMES}, {"default": {"maxWidth": 160, "format": "png", "palette": True}}),
        'aid': ({'playeraid.jpg': 'player_aid.jpg', 'aidbank.jpg': 'aid_bank.jpg', 'aidcash.jpg': 'aid_cash.jpg', **{f'note{n}.jpg': f'note_{n}.jpg' for n in (1, 2, 3, 4)}}, {"default": {"maxWidth": 1024, "format": "jpg"}, "overrides": {"note": {"maxWidth": 300, "format": "jpg"}}}),
        'environment': ({'table.jpg': 'table.jpg'}, {"default": {"maxWidth": 1024, "format": "jpg"}}),
        'tracks': ({'tracks.jpg': 'tracks.jpg'}, {"default": {"maxWidth": 600, "format": "jpg"}}),
    }
    total = 0
    for folder, (manifest, sprite) in folders.items():
        for src in manifest.values():
            if not os.path.exists(os.path.join(BUILD, src)): raise SystemExit(f'missing build file {src}')
        d = os.path.join(ASSETS, folder); os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f != 'sprite.json': os.remove(os.path.join(d, f))
        for dst, src in manifest.items():
            data = open(os.path.join(BUILD, src), 'rb').read(); open(os.path.join(d, dst), 'wb').write(data); total += len(data)
        json.dump(sprite, open(os.path.join(d, 'sprite.json'), 'w'), indent=2)
    print(f'shipped {total / 1e6:.2f} MB of sources into src/assets (the packer resizes them)')
ship_art()
