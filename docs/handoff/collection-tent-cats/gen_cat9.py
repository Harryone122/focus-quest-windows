"""Procedural calico cat (lying pose) -> mesh + per-vertex fur attributes.
Units: metres. Cat local frame: head toward +X, up +Y, cat's left side +Z (camera side).
Output: cat_data.json (base64 arrays + meta)."""
import numpy as np, json, base64, sys
from skimage.measure import marching_cubes
import fast_simplification
import newhead9 as NH

f32 = np.float32

def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def smax(a, b, k):
    return -smin(-a, -b, k)

def ell(p, c, r):
    q = (p - np.array(c, f32)) / np.array(r, f32)
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / np.array(r, f32), axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)

def cap(p, a, b, ra, rb=None):
    if rb is None: rb = ra
    a = np.array(a, f32); b = np.array(b, f32)
    pa = p - a; ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    r = ra + (rb - ra) * h
    return np.linalg.norm(pa - h[..., None] * ba, axis=-1) - r

def sph(p, c, r):
    return np.linalg.norm(p - np.array(c, f32), axis=-1) - r

# ---------------- anatomy constants ----------------
H = np.array([0.222, 0.22, 0.0], f32)          # head centre
HS = 1.13                                       # head scale (bigger, cuter head)
EYE_R = NH.EYE_R * NH.K * HS
EYES = [(H + NH.their_eye(s)[0] * HS).astype(f32) for s in (1, -1)]   # +Z = cat's RIGHT
EYE_FR = [tuple(np.asarray(v, f32) for v in NH.their_eye(s)[1:]) for s in (1, -1)]   # gaze, up, outer-side
EAR_BASE = [(H + (NH.O + NH.K * np.array([-0.016, 0.029, -s * -0.037])) * HS).astype(f32) for s in (1, -1)]
NECK_PIVOT = np.array([0.155, 0.150, 0.0], f32)

def ear_frame(s):
    up = np.array([0.06, 1.0, s * 0.5], f32); up /= np.linalg.norm(up)
    fw = np.array([1.0, 0.0, s * 0.42], f32)
    fw -= up * (fw @ up); fw /= np.linalg.norm(fw)
    side = np.cross(up, fw)
    return np.stack([side, up, fw])  # rows: local x, y, z

EAR_R = [ear_frame(1), ear_frame(-1)]

def ear_sdf(p, s):
    i = 0 if s == 1 else 1
    R = EAR_R[i]
    q = (p - EAR_BASE[i]) @ R.T / HS  # local coords (x side, y up, z front)
    Hh, Rb = 0.043, 0.024
    def cone(q, Hh, Rb, zoff, sq):
        y = q[..., 1]
        r = Rb * (1 - y / Hh)
        rad = np.sqrt(q[..., 0] ** 2 + ((q[..., 2] - zoff) / sq) ** 2)
        d = (rad - r) * (Hh / np.sqrt(Hh * Hh + Rb * Rb))
        return np.maximum(np.maximum(d, -(y + 0.012)), y - Hh)   # base sinks into the skull
    outer = cone(q, Hh, Rb, 0.0, 0.62)
    inner = cone(q - np.array([0, 0.004, 0], f32), Hh * 0.86, Rb * 0.80, 0.0065, 0.55)
    return (smax(outer, -inner, 0.002) - 0.0012) * HS

# tail spline
TAIL_PTS = np.array([(-0.255, 0.075, 0.0), (-0.305, 0.052, 0.07), (-0.255, 0.033, 0.152),
                     (-0.13, 0.028, 0.188), (0.01, 0.028, 0.192), (0.13, 0.03, 0.17),
                     (0.195, 0.033, 0.132)], f32)

def catmull(P, n):
    P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out, f32)

TAIL = catmull(TAIL_PTS, 6)
TN = len(TAIL)
TAIL_R = np.linspace(0.026, 0.017, TN).astype(f32)

def parts(p):
    """Return dict of component SDFs."""
    d = {}
    # body
    torso = ell(p, (-0.02, 0.083, 0.0), (0.19, 0.083, 0.106))
    back = ell(p, (-0.05, 0.108, 0.0), (0.15, 0.062, 0.082))
    chest = ell(p, (0.118, 0.092, 0.0), (0.086, 0.09, 0.08))
    haunchL = ell(p, (-0.13, 0.076, 0.04), (0.105, 0.076, 0.098))
    haunchR = ell(p, (-0.13, 0.07, -0.03), (0.095, 0.07, 0.085))
    neck = cap(p, (0.13, 0.12, 0.0), H + np.array([-0.022, -0.03, 0], f32), 0.054, 0.05)
    body = smin(torso, back, 0.04)
    body = smin(body, chest, 0.04)
    body = smin(body, haunchL, 0.035)
    body = smin(body, haunchR, 0.035)
    d['body'] = body
    # throat ruff under the jaw: keeps the outline round where the head meets the chest
    neck = smin(neck, ell(p, H + np.array([-0.01, -0.052, 0.0], f32), (0.04, 0.03, 0.05)), 0.02)
    d['neck'] = neck
    d['chest'] = chest
    # front legs + paws
    legs = []; paws = []
    for s in (1, -1):
        legs.append(cap(p, (0.10, 0.036, s * 0.048), (0.245, 0.022, s * 0.046), 0.022, 0.019))
        pw = ell(p, (0.268, 0.018, s * 0.046), (0.03, 0.018, 0.024))
        for k, dz in enumerate((-0.015, -0.005, 0.005, 0.015)):
            pw = smin(pw, sph(p, (0.289 - abs(dz) * 0.25, 0.014, s * 0.046 + dz), 0.0088), 0.006)
        paws.append(pw)
    d['legs'] = np.minimum(legs[0], legs[1])
    d['paws'] = np.minimum(paws[0], paws[1])
    # hind foot (camera side)
    d['hleg'] = cap(p, (-0.11, 0.028, 0.112), (0.02, 0.02, 0.124), 0.022, 0.018)
    hp = ell(p, (0.04, 0.017, 0.124), (0.03, 0.017, 0.022))
    for dz in (-0.013, -0.004, 0.005, 0.014):
        hp = smin(hp, sph(p, (0.06 - abs(dz) * 0.3, 0.013, 0.124 + dz), 0.0078), 0.005)
    d['hpaw'] = hp
    # head (evaluated in head-scaled space) -- v8: new head from newhead.py (reference 3-view)
    po = p
    p = H + (po - H) / HS
    dh = NH.parts_their(p - H)
    for k in ('nose', 'muzzle', 'chin', 'cheeks', 'cran', 'head'):
        d[k] = (dh[k] * HS).astype(f32)
    p = po
    d['earL'] = ear_sdf(p, 1)
    d['earR'] = ear_sdf(p, -1)
    # tail
    t = np.full(p.shape[:-1], 1e9, f32)
    for i in range(TN - 1):
        t = np.minimum(t, cap(p, TAIL[i], TAIL[i + 1], TAIL_R[i], TAIL_R[i + 1]))
    d['tail'] = t
    return d

def total(d):
    s = smin(d['body'], d['neck'], 0.04)
    s = smin(s, d['legs'], 0.03)
    s = smin(s, d['paws'], 0.012)
    s = smin(s, d['hleg'], 0.025)
    s = smin(s, d['hpaw'], 0.01)
    s = smin(s, d['head'], 0.022)
    s = smin(s, d['earL'], 0.011)
    s = smin(s, d['earR'], 0.011)
    s = smin(s, d['tail'], 0.016)
    return s

def sdf_total(p):
    s = total(parts(p))
    return smax(s, -(p[..., 1] - 0.003), 0.006)   # flatten belly on cushion

# ---------------- mesh ----------------
RES = 0.0016
lo = np.array([-0.37, -0.005, -0.15], f32); hi = np.array([0.34, 0.34, 0.235], f32)
dims = np.ceil((hi - lo) / RES).astype(int) + 1
print('grid', dims, np.prod(dims))
xs = [lo[i] + np.arange(dims[i], dtype=f32) * RES for i in range(3)]
vol = np.empty(dims, f32)
for ix in range(dims[0]):
    X, Y, Z = np.meshgrid(xs[0][ix:ix + 1], xs[1], xs[2], indexing='ij')
    P = np.stack([X, Y, Z], -1)[0]
    vol[ix] = sdf_total(P)
verts, faces, _, _ = marching_cubes(vol, 0.0, spacing=(RES, RES, RES))
verts = verts.astype(f32) + lo
print('mc', len(verts), len(faces))
target = int(sys.argv[1]) if len(sys.argv) > 1 else 70000
red = 1 - target / len(faces)
verts, faces = fast_simplification.simplify(verts, faces.astype(np.int64), red)
verts = verts.astype(f32)
print('simpl', len(verts), len(faces))

# normals from SDF gradient
def grad(P, e=0.0007):
    g = np.zeros_like(P)
    for i in range(3):
        dv = np.zeros(3, f32); dv[i] = e
        g[:, i] = sdf_total(P + dv) - sdf_total(P - dv)
    return g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
N = grad(verts)
# blend with mesh normals for thin parts (ears) where SDF gradient is noisy
import trimesh
tm = trimesh.Trimesh(verts, faces, process=False)
Nm = tm.vertex_normals.astype(f32)
D = parts(verts)
earw = np.exp(-np.maximum(np.minimum(D['earL'], D['earR']), 0) / 0.003)
N = N * (1 - earw[:, None]) + Nm * earw[:, None]
N /= np.linalg.norm(N, axis=1, keepdims=True)

# ---------------- soft region weights ----------------
names = ['body', 'neck', 'chest', 'legs', 'paws', 'hleg', 'hpaw', 'cran', 'cheeks', 'muzzle', 'chin', 'nose', 'earL', 'earR', 'tail']
Dm = np.stack([D[n] for n in names], 1)
dmin = Dm.min(1, keepdims=True)
W = np.exp(-(Dm - dmin) / 0.005)
W /= W.sum(1, keepdims=True)
w = {n: W[:, i] for i, n in enumerate(names)}

# fur length
LEN = dict(body=0.017, neck=0.024, chest=0.026, legs=0.009, paws=0.0055, hleg=0.012, hpaw=0.0055,
           cran=0.007, cheeks=0.0095, muzzle=0.0035, chin=0.006, nose=0.0, earL=0.0045, earR=0.0045, tail=0.021)
flen = sum(w[n] * LEN[n] for n in names)

# tail param
dt = np.linalg.norm(verts[:, None, :] - TAIL[None, :, :], axis=2)
ti = dt.argmin(1)
tparam = ti / (TN - 1)
istail = w['tail']
flen = flen + istail * sstep(0.6, 1.0, tparam) * 0.004

# fluffy jowls on the outer cheeks / under the jaw (reference: soft cheek outline), face centre stays short
mzc = (verts - H) / HS
headw0 = w['cran'] + w['cheeks'] + w['muzzle'] + w['chin']
jowl = sstep(0.022, 0.045, np.abs(mzc[:, 2])) * sstep(0.012, -0.01, mzc[:, 1]) * sstep(0.045, 0.0, mzc[:, 0]) * headw0
flen = flen + jowl * 0.014
# skin masks
earf = np.zeros(len(verts), f32); earh = np.zeros(len(verts), f32)
for i, s in enumerate((1, -1)):
    R = EAR_R[i]
    q = (verts - EAR_BASE[i]) @ R.T
    m = w['earL'] if s == 1 else w['earR']
    front = sstep(0.2, 0.6, N @ R[2]) * sstep(0.002, 0.008, q[:, 1]) * m
    earf = np.maximum(earf, front)
    earh = np.maximum(earh, m * sstep(-0.004, 0.012, q[:, 1]))
nosem = sstep(0.0036, 0.0008, D['nose']) * sstep(-0.026, -0.021, (verts[:, 1] - H[1]) / HS)
skin = np.maximum(nosem, earf)
sparse = earf.copy()                       # inner ear: sparse pale furnishings
flen = flen * (1 - nosem)
flen = np.where(earf > 0.5, 0.0095, flen)   # long pale ear furnishings
rim = np.zeros(len(verts), f32)
for e in EYES:
    de = np.linalg.norm(verts - e, axis=1) - EYE_R
    rim = np.maximum(rim, 1 - sstep(0.0004, 0.0013, de))
    # v9: thin bare lid margin, then very short fur that only reaches full length well away from the eye,
    # so the fur never builds a wall in front of the eyeball (v8 eyes looked sunk in side view)
    flen = flen * sstep(0.0012, 0.0040, de) * (0.30 + 0.70 * sstep(0.004, 0.018, de))
# mouth line (dark) under whisker pads
mz = (verts - H) / HS
mouth = (1 - sstep(0.0, 0.0022, np.abs(mz[:, 1] + 0.0345 - 0.004 * np.abs(mz[:, 2]) / 0.02))) * sstep(0.026, 0.04, mz[:, 0]) * (1 - sstep(0.012, 0.022, np.abs(mz[:, 2])))
# nose-to-mouth philtrum
phil = (1 - sstep(0.0, 0.0012, np.abs(mz[:, 2]))) * sstep(-0.0175, -0.016, -mz[:, 1]) * (1 - sstep(-0.031, -0.029, -mz[:, 1])) * sstep(0.045, 0.05, mz[:, 0])
mouth = np.maximum(mouth, phil)

# comb direction
x, y, z = verts[:, 0], verts[:, 1], verts[:, 2]
comb = np.zeros_like(verts)
comb[:] = (-1.0, -0.35, 0.0)                     # body: toward tail and down
# sides: flow downward along flanks
comb[:, 1] -= 0.6 * np.abs(N[:, 2])
headw = w['cran'] + w['cheeks'] + w['muzzle'] + w['chin'] + w['nose']
hdir = np.stack([-np.ones_like(x), -0.2 * np.ones_like(x), np.clip(z / 0.02, -1, 1) * 0.6], 1)  # away from nose, outward
comb = comb * (1 - headw[:, None]) + hdir * headw[:, None]
for e in EYES:
    de_ = verts - e
    r_ = np.linalg.norm(de_, axis=1)
    we_ = (1 - sstep(EYE_R + 0.004, EYE_R + 0.012, r_))[:, None]
    comb = comb * (1 - we_) + de_ / np.maximum(r_[:, None], 1e-6) * we_
legw = w['legs'] + w['paws'] + w['hleg'] + w['hpaw']
comb = comb * (1 - legw[:, None]) + np.array([0.9, -0.5, 0.0], f32) * legw[:, None]
tang = np.gradient(TAIL, axis=0)[ti]
comb = comb * (1 - istail[:, None]) + tang / np.linalg.norm(tang, axis=1, keepdims=True) * istail[:, None]
eardir = np.zeros_like(verts)
for i in range(2):
    m = (w['earL'] if i == 0 else w['earR'])[:, None]
    eardir += EAR_R[i][1] * m
comb = comb * (1 - (w['earL'] + w['earR'])[:, None]) + eardir
# chest ruff points down
comb = comb * (1 - w['chest'][:, None] * 0.6) + np.array([0.1, -1.0, 0.0], f32) * w['chest'][:, None] * 0.6
comb -= N * (comb * N).sum(1, keepdims=True)
comb /= np.maximum(np.linalg.norm(comb, axis=1, keepdims=True), 1e-6)

# ---------------- calico pattern ----------------
rng = np.random.default_rng(7)
def vnoise3(P, freq, seed):
    r = np.random.default_rng(seed)
    G = r.normal(size=(64, 3)).astype(f32)
    acc = np.zeros(len(P), f32)
    for g in G[:24]:
        g = g / np.linalg.norm(g)
        ph = r.uniform(0, 2 * np.pi)
        fq = freq * r.uniform(0.7, 1.4)
        acc += np.sin(P @ g * fq * 2 * np.pi + ph)
    return acc / np.sqrt(24 / 2)
n1 = vnoise3(verts, 9.0, 1) * 0.5 + vnoise3(verts, 22.0, 2) * 0.25

def blob(c, r):
    return np.exp(-np.sum(((verts - np.array(c, f32)) / np.array(r, f32)) ** 2, 1))

# white regions
white = np.zeros(len(verts), f32)
white = np.maximum(white, sstep(0.05, 0.02, y) * (1 - istail))              # underside
white = np.maximum(white, legw)
white = np.maximum(white, w['chest'] * sstep(0.17, 0.11, y) * sstep(0.06, 0.12, x))  # bib
white = np.maximum(white, w['neck'] * sstep(0.16, 0.13, y) * sstep(0.15, 0.18, x))
white = np.maximum(white, (w['muzzle'] * sstep(-0.004, -0.012, mz[:, 1]) + w['chin']) * 1.0)
white = np.maximum(white, w['cheeks'] * sstep(-0.006, -0.016, mz[:, 1]))
blaze = (1 - sstep(0.0032, 0.0052 + 0.0105 * sstep(0.005, -0.009, mz[:, 1]), np.abs(mz[:, 2]))) * sstep(0.015, 0.03, mz[:, 0]) * headw
white = np.maximum(white, blaze * sstep(0.02, 0.0, mz[:, 1] - 0.0))
white = np.maximum(white, blob((0.0, 0.03, 0.10), (0.09, 0.03, 0.04)) * 0.9)     # belly side
white = np.maximum(white, blob((0.205, 0.15, 0.0), (0.045, 0.045, 0.05)) * sstep(0.17, 0.2, x) * (1 - headw * 0.6))   # white throat / bib like the reference
white = np.clip(white + n1 * 0.12 * (1 - headw), 0, 1)
white = np.maximum(white, blob(H + np.array((0.012, -0.066, 0.0), f32), (0.055, 0.045, 0.065)) * 0.95)   # white throat under the chin
white = white * (1 - (w['earL'] + w['earR']))
# --- v8: the white muzzle / chin / blaze are puffy: longer fur there, radiating from the nose
fw_ = np.clip(white * headw0 * (1 - nosem), 0, 1)
puff = w['muzzle'] * 0.0078 + w['chin'] * 0.0092 + w['cran'] * 0.0058 + w['cheeks'] * 0.0
flen = np.maximum(flen, fw_ * puff * (1 - rim * 0.95))
# v9: fur right round the nose is very short, so the nose tip stays the front-most point instead of sinking into the muzzle puff
nshort = 0.22 + 0.78 * sstep(0.0012, 0.0085, D['nose'] / HS)
flen = flen * (1 - headw0 * (1 - nshort))
nose_pt = H + NH.to_their(NH.NOSE_MINE) * HS
rad_ = verts - nose_pt
rad_ -= N * (rad_ * N).sum(1, keepdims=True)
rad_ /= np.maximum(np.linalg.norm(rad_, axis=1, keepdims=True), 1e-6)
mw_ = np.clip((w['muzzle'] + w['chin']) * headw0, 0, 1)[:, None]
comb = comb * (1 - mw_) + rad_ * mw_
comb /= np.maximum(np.linalg.norm(comb, axis=1, keepdims=True), 1e-6)
white = np.maximum(white, earf * 0.0)

# orange vs black
orange = 0.5 + 0.55 * n1
# NOTE: local +Z is the cat's RIGHT side (camera side). Reference: cat's right half of the face black, left orange
orange += blob(H + np.array((0.015, 0.035, -0.012),f32)*HS, (0.04, 0.03, 0.035)) * 0.9     # orange forehead
orange -= blob(H + np.array((0.024, 0.012, 0.036),f32)*HS, (0.040, 0.040, 0.032)) * 3.2 * sstep(0.002, 0.008, mz[:, 2])      # black over the cat's right face (reference), stops at the blaze
orange -= blob(H + np.array((0.0, -0.012, 0.046),f32)*HS, (0.032, 0.03, 0.024)) * 1.5          # black right cheek
orange += blob(H + np.array((0.03, 0.006, -0.029),f32)*HS, (0.027, 0.027, 0.022)) * 1.0     # orange around left eye
orange -= blob(H + np.array((0.027, -0.013, -0.050),f32)*HS, (0.024, 0.009, 0.022)) * 1.4   # black streak under left eye
orange += blob(EAR_BASE[0] + (0, 0.02, 0), (0.03, 0.045, 0.03)) * 0.9   # right ear orange
orange -= blob(EAR_BASE[1] + (0, 0.02, 0), (0.03, 0.045, 0.03)) * 1.6   # left ear black
orange -= blob((-0.04, 0.16, 0.0), (0.12, 0.05, 0.08)) * 0.7           # black saddle
orange += blob((-0.13, 0.10, 0.11), (0.06, 0.05, 0.05)) * 0.9          # orange haunch patch
orange += blob((0.06, 0.12, 0.10), (0.05, 0.04, 0.04)) * 0.8           # orange shoulder patch
orange = np.clip(orange, 0, 1)
# tail bands
tb = 0.5 + 0.5 * np.sin(tparam * 2 * np.pi * 4.5 + 0.8)
orange = orange * (1 - istail) + istail * np.where(tparam > 0.88, 0.0, tb)
# tabby stripe coordinate (body): along spine
stripe = (x * 19.0 + n1 * 0.9) * (1 - istail) + istail * (tparam * 9.0)

# ---------------- AO ----------------
def sdf_scene(P):
    return np.minimum(sdf_total(P), P[:, 1] + 0.002)
ao = np.zeros(len(verts), f32)
sc = 1.0
for k, hh in enumerate([0.004, 0.009, 0.016, 0.026, 0.04]):
    dd = sdf_scene(verts + N * hh)
    ao += (hh - dd) * sc
    sc *= 0.7
ao = np.clip(1 - ao * 9.0, 0.15, 1.0)

# deformation weights
headdef = sstep(0.16, 0.207, x) * sstep(0.10, 0.135, y)
headdef = np.maximum(headdef, np.clip(headw + w['earL'] + w['earR'], 0, 1) * sstep(0.12, 0.15, y))
bodydef = np.clip(w['body'] + w['chest'] + w['neck'] * 0.5, 0, 1) * (1 - headdef) * sstep(0.03, 0.08, y)
tailw = istail * sstep(0.45, 1.0, tparam)
earLw = w['earL'] * sstep(-0.002, 0.01, ((verts - EAR_BASE[0]) @ EAR_R[0][1]))
earRw = w['earR'] * sstep(-0.002, 0.01, ((verts - EAR_BASE[1]) @ EAR_R[1][1]))

def b64(a, dt):
    return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode()

attrs = np.stack([flen, white, orange, skin, sparse, rim, mouth, ao, stripe], 1)
defw = np.stack([headdef, bodydef, tailw, earLw, earRw], 1)
pivot_i = int(round(0.45 * (TN - 1)))
out = dict(
    pos=b64(verts, '<f4'), nrm=b64(N, '<f4'), comb=b64(comb, '<f4'),
    attr=b64(attrs, '<f4'), defw=b64(defw, '<f4'), idx=b64(faces, '<u4'),
    nv=len(verts), nf=len(faces),
    meta=dict(H=H.tolist(), eyes=[e.tolist() for e in EYES], eyeR=EYE_R,
              earBase=[e.tolist() for e in EAR_BASE], earAxes=[R.tolist() for R in EAR_R],
              neck=NECK_PIVOT.tolist(), tailPivot=TAIL[pivot_i].tolist(),
              tailTan=(TAIL[pivot_i + 1] - TAIL[pivot_i - 1]).tolist(),
              tailTip=TAIL[-1].tolist(),
              pads=[(H + NH.to_their(NH.PAD_MINE * np.array([1, -s, 1])) * HS).tolist() for s in (1, -1)],
              nose=(H + NH.to_their(NH.NOSE_MINE) * HS).tolist(), HS=HS,
              eyeGaze=[EYE_FR[i][0].tolist() for i in range(2)], eyeUp=[EYE_FR[i][1].tolist() for i in range(2)]))
json.dump(out, open('cat_data.json', 'w'))
print('stats len', flen.min(), flen.max(), 'ao', ao.min(), ao.mean(), 'white', white.mean())
trimesh.Trimesh(verts, faces, process=False).export('cat_base.obj')
