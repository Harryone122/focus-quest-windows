"""Procedural calico cat (lying pose) -> mesh + per-vertex fur attributes.
Units: metres. Cat local frame: head toward +X, up +Y, cat's left side +Z (camera side).
Output: cat_data.json (base64 arrays + meta)."""
import numpy as np, json, base64, sys
from skimage.measure import marching_cubes
import fast_simplification
import newhead12 as NH            # v12: head shape from the reference model
import newhead11 as OH            # old head: coat, fur and painted details (through NH.old_coords)
from scipy.spatial import cKDTree

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
EAR_BASE = [(H + (NH.O + NH.K * np.array([NH.EAR_BASE_MINE[0], NH.EAR_BASE_MINE[2], s * NH.EAR_BASE_MINE[1]])) * HS).astype(f32) for s in (1, -1)]
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
    neck = smin(neck, ell(p, H + np.array([0.002, -0.054, 0.0], f32), (0.042, 0.032, 0.05)), 0.022)   # v10: ruff sits further forward under the chin
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
    d['head'] = (NH.parts_their(p - H)['head'] * HS).astype(f32)
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

# ---------------- v10: jaw ----------------
def cat_to_mine(P):
    return NH.to_mine((P - H) / HS)

def mine_to_cat(m):
    return H + HS * NH.to_their(m)

KS = NH.K * HS                                   # mine metres -> cat metres
HINGE_CAT = mine_to_cat(np.array([NH.HINGE[0], 0.0, NH.HINGE[1]])).astype(f32)

def rotz(P, piv, a):
    """rotate cat-frame points about the cat +z axis through piv by angle(s) a (closing the jaw = +a)."""
    d = P - piv
    ca, sa = np.cos(a), np.sin(a)
    return np.stack([piv[0] + d[:, 0] * ca - d[:, 1] * sa, piv[1] + d[:, 0] * sa + d[:, 1] * ca, P[:, 2]], 1)

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
# v11: finer mesh round the mouth (the simplifier leaves big triangles there; the lips need small ones to part cleanly)
import trimesh
for _ in range(2):
    mo_ = cat_to_mine(verts)
    cen = mo_[faces].mean(1)
    near = np.where(np.linalg.norm(cen - np.array([NH.LIP_FRONT - 0.004, 0.0, NH.crease_line(0.0)[1]]), axis=1) < 0.021)[0]
    verts, faces = trimesh.remesh.subdivide(verts, faces, face_index=near)
    verts = verts.astype(f32)
for _ in range(3):                                   # pull every vertex back onto the surface
    d_ = sdf_total(verts)
    g_ = np.zeros_like(verts)
    for i in range(3):
        dv = np.zeros(3, f32); dv[i] = 0.0004
        g_[:, i] = (sdf_total(verts + dv) - sdf_total(verts - dv)) / 0.0008
    verts = (verts - g_ * (d_ / np.maximum((g_ * g_).sum(1), 1e-9))[:, None]).astype(f32)
print('after mouth refine', len(verts), len(faces))
N = grad(verts)
import trimesh
tm = trimesh.Trimesh(verts, faces, process=False)
Nm = tm.vertex_normals.astype(f32)
# blend with mesh normals for thin parts (ears) where SDF gradient is noisy
D = parts(verts)
earw = np.exp(-np.maximum(np.minimum(D['earL'], D['earR']), 0) / 0.003)
N = N * (1 - earw[:, None]) + Nm * earw[:, None]
N /= np.linalg.norm(N, axis=1, keepdims=True)

# ---------------- v11: cut the lips open along the mouth crease (rest pose stays closed) ----------------
mo = cat_to_mine(verts)
side = mo[:, 2] - NH.mouth_z(mo[:, 0], mo[:, 1])          # > 0 upper jaw, < 0 lower jaw (metres, mine)
gin = NH.gape_in(mo[:, 0], mo[:, 1])
fs = side[faces]
straddle = (fs.min(1) < 0) & (fs.max(1) > 0)
in_gape = (gin[faces] > -0.0004).all(1) & (np.abs(fs).max(1) < 0.006)
cutf = straddle & in_gape
print('cut faces', int(cutf.sum()))
# v12: split every straddling face exactly along the cut surface (side = 0). The new points lie on the original
# triangle edges, so at rest the two lips share them and the seam has zero width; the lower lip gets its own copies.
side0 = side.copy()
cut_faces = faces[cutf]
faces = faces[~cutf]
ekey = {}
newV, newN, newNm, newS = [], [], [], []
def edge_point(a, b):
    k = (min(a, b), max(a, b))
    if k in ekey: return ekey[k]
    t = side0[a] / (side0[a] - side0[b])
    p = verts[a] * (1 - t) + verts[b] * t
    n = N[a] * (1 - t) + N[b] * t; n /= np.linalg.norm(n)
    nm = Nm[a] * (1 - t) + Nm[b] * t; nm /= max(np.linalg.norm(nm), 1e-9)
    idx = len(verts) + len(newV)
    newV.append(p); newN.append(n); newNm.append(nm); newS.append(0.0)
    ekey[k] = idx
    return idx
upper_tris, lower_tris = [], []
for f in cut_faces:
    s = side0[f] > 0
    # rotate so that the lone vertex (the one on its own side) comes first, keeping the winding
    lone = int(np.where(s != (s.sum() >= 2))[0][0]) if s.sum() in (1, 2) else 0
    a, b, c = f[lone], f[(lone + 1) % 3], f[(lone + 2) % 3]
    pab, pca = edge_point(a, b), edge_point(c, a)
    lone_up = side0[a] > 0
    tri = [(a, pab, pca)]
    quad = [(pab, b, c), (pab, c, pca)]
    (upper_tris if lone_up else lower_tris).extend(tri)
    (lower_tris if lone_up else upper_tris).extend(quad)
n0 = len(verts)
verts = np.concatenate([verts, np.array(newV, f32)]); N = np.concatenate([N, np.array(newN, f32)]); Nm = np.concatenate([Nm, np.array(newNm, f32)])
side0 = np.concatenate([side0, np.array(newS)])
gin = np.concatenate([gin, NH.gape_in(*cat_to_mine(np.array(newV, f32))[:, :2].T)])
# the lower lip gets its own copies of the seam points
seam = np.arange(n0, len(verts))
dupmap = {int(v): len(verts) + i for i, v in enumerate(seam)}
verts = np.concatenate([verts, verts[seam]]); N = np.concatenate([N, N[seam]]); Nm = np.concatenate([Nm, Nm[seam]])
side0 = np.concatenate([side0, side0[seam]]); gin = np.concatenate([gin, gin[seam]])
lower_tris = [tuple(dupmap.get(int(v), int(v)) for v in t) for t in lower_tris]
faces = np.concatenate([faces, np.array(upper_tris, faces.dtype), np.array(lower_tris, faces.dtype)])
edge = np.zeros(len(verts), bool); edge[seam] = True; edge[list(dupmap.values())] = True
side_lab = np.zeros(len(verts)); side_lab[seam] = 1e-5; side_lab[list(dupmap.values())] = -1e-5
mo = cat_to_mine(verts)
side = np.where(edge, side_lab, mo[:, 2] - NH.mouth_z(mo[:, 0], mo[:, 1]))
bverts = np.where(edge)[0]
print('seam points', len(seam), 'faces', len(faces))
# jaw weight: lower side turns with the jaw. Inside the opening the split is sharp; beside it the skin stretches
hx, hz = NH.HINGE
r_h = np.hypot(mo[:, 0] - hx, mo[:, 2] - hz)
region = (1 - sstep(0.046, 0.060, r_h)) * sstep(-0.062, -0.048, mo[:, 2]) * sstep(hx - 0.006, hx + 0.004, mo[:, 0])
g_ = sstep(-0.0012, 0.0012, gin)
sharp = (side < 0).astype(f32)
smooth = sstep(0.004, -0.004, side)
JW = (region * (g_ * sharp + (1 - g_) * smooth)).astype(f32)
# lip edge distance (for the dark lip line and the fur that parts when the mouth opens)
kd = cKDTree(verts[bverts])
dlip, _ = kd.query(verts, k=1)
mzone = ((np.linalg.norm(mo - NH.MOUTH_C, axis=1) < 0.026)).astype(f32)   # inner faces seen through the mouth = lining
# ---------------- v14: mouth pocket welded to the lip seam ----------------
# Upper sheet (palate) starts on the upper-lip seam copies, lower sheet (tongue bed) on the lower copies; both run back
# toward the throat; side and back strips join them. At rest the two sheets meet at the lips and lie inside the head.
up_c = mine_to_cat(np.array([0, 0, 1.0])) - mine_to_cat(np.array([0, 0, 0.0])); up_c /= np.linalg.norm(up_c)
bk_c = mine_to_cat(np.array([-1.0, 0, 0])) - mine_to_cat(np.array([0, 0, 0.0])); bk_c /= np.linalg.norm(bk_c)
ms = cat_to_mine(verts[seam])
order = np.argsort(ms[:, 1])
sU = seam[order]; sL = np.array([dupmap[int(v)] for v in sU])
ys_seam = ms[order][:, 1]
ymax = np.abs(ms[:, 1]).max()
JP, NB = 9, 24                                                   # rows into the mouth, evenly spaced columns (no slivers)
tB = np.linspace(-1, 1, NB)
seamP = verts[sU]
def seam_at(t):                                                  # point on the lip seam at lateral fraction t
    y = t * ymax
    return np.array([np.interp(y, ys_seam, seamP[:, k]) for k in range(3)])
base = len(verts)
PV, PJ, PL = [], [], []
def pocket_pt(t, j, sheet):
    p0 = seam_at(t)
    m0 = cat_to_mine(p0[None])[0]
    fj = j / JP
    depth = 0.024 * (1 - 0.35 * t * t) * fj
    m1 = np.array([m0[0] - depth, m0[1] * (1.0 + 0.22 * fj), m0[2]])
    c = np.sqrt(max(1 - t * t, 0)) * 0.85 + 0.15
    rise = np.sin(0.5 * np.pi * min(fj * 1.4, 1.0)) ** 0.8
    hgt = (0.0060 if sheet == 'U' else -0.0030) * rise * c
    return mine_to_cat(m1 + np.array([0, 0, hgt]))
idx = {}
for sheet in ('U', 'L'):
    for k in range(NB):
        for j in range(1, JP + 1):
            idx[(sheet, k, j)] = base + len(PV)
            PV.append(pocket_pt(tB[k], j, sheet)); PJ.append(0.0 if sheet == 'U' else 1.0); PL.append(j / JP)
PF = []
for sheet in ('U', 'L'):
    up_sheet = sheet == 'U'
    # lips (dense seam) -> first pocket row (24 columns): zipper triangulation by lateral position
    A = list(sU) if up_sheet else list(sL)
    tA = ys_seam / ymax
    B = [idx[(sheet, k, 1)] for k in range(NB)]
    i, k = 0, 0
    while i < len(A) - 1 or k < NB - 1:
        adv_a = k >= NB - 1 or (i < len(A) - 1 and tA[i + 1] <= tB[k + 1])
        if adv_a:
            tri = (A[i], B[k], A[i + 1]) if up_sheet else (A[i], A[i + 1], B[k]); i += 1
        else:
            tri = (A[i], B[k], B[k + 1]) if up_sheet else (A[i], B[k + 1], B[k]); k += 1
        PF.append(tri)
    for k in range(NB - 1):
        for j in range(1, JP):
            a, b, c, d = idx[(sheet, k, j)], idx[(sheet, k + 1, j)], idx[(sheet, k + 1, j + 1)], idx[(sheet, k, j + 1)]
            PF += [(a, c, b), (a, d, c)] if up_sheet else [(a, b, c), (a, c, d)]
for k in range(NB - 1):                                          # back of the mouth (throat), facing forward
    a, b, c, d = idx[('U', k, JP)], idx[('U', k + 1, JP)], idx[('L', k + 1, JP)], idx[('L', k, JP)]
    PF += [(a, c, b), (a, d, c)]
for k_end, flip in ((0, False), (NB - 1, True)):                 # the two sides, facing inward
    for j in range(1, JP):
        a, b, c, d = idx[('U', k_end, j)], idx[('U', k_end, j + 1)], idx[('L', k_end, j + 1)], idx[('L', k_end, j)]
        PF += [(a, c, b), (a, d, c)] if not flip else [(a, b, c), (a, c, d)]
    a, b, c = (sU[0], idx[('U', k_end, 1)], idx[('L', k_end, 1)]) if k_end == 0 else (sU[-1], idx[('L', k_end, 1)], idx[('U', k_end, 1)])
    PF.append((a, b, c))
PV = np.array(PV, f32); PF = np.array(PF, faces.dtype)
allv = np.concatenate([verts, PV])
nP = len(PV)
verts = allv; faces = np.concatenate([faces, PF])
tmp = trimesh.Trimesh(verts, faces, process=False)
vn_all = tmp.vertex_normals.astype(f32)
N = np.concatenate([N, vn_all[base:]]); Nm = np.concatenate([Nm, vn_all[base:]])
JW = np.concatenate([JW, np.array(PJ, f32)])
dlip = np.concatenate([dlip, np.full(nP, 1.0)])
mzone = np.concatenate([mzone, np.full(nP, 2.0, f32)])            # 2 = mouth lining (front faces)
pocket_depth = np.concatenate([np.zeros(base, f32), np.array(PL, f32)])
mo = cat_to_mine(verts)
print('mouth pocket', nP, 'verts', len(PF), 'faces')
# tongue lies on the floor of the pocket; canines sit just inside the lips (cat frame, before the final warp)
Lrows = np.array([pocket_pt(t, j, 'L') for t in np.linspace(-0.6, 0.6, 7) for j in range(2, 7)])
TONGUE_C = Lrows.mean(0) + up_c * 0.0014 * KS
TONGUE_R = [0.0105 * KS, 0.0018 * KS, 0.55 * ymax * KS]
TEETH12 = []
for frac, jaw in ((0.62, 0), (0.50, 1)):
    for sgn in (1, -1):
        p = seam_at(sgn * frac)
        if jaw == 0:
            TEETH12.append(dict(b=(p + up_c * 0.0012 * KS + bk_c * 0.0014 * KS), t=(p - up_c * 0.0030 * KS + bk_c * 0.0010 * KS), r=0.0012 * KS, jaw=0))
        else:
            TEETH12.append(dict(b=(p - up_c * 0.0016 * KS + bk_c * 0.0020 * KS), t=(p + up_c * 0.0020 * KS + bk_c * 0.0016 * KS), r=0.0010 * KS, jaw=1))
# ---------------- v12: coat, fur and painted details follow the old head ----------------
VN = verts                                            # new geometry (output positions, eyes, ears, lids, AO)
D = parts(VN)                                         # ears / body on the new geometry (after the cut added seam points)
VO = mine_to_cat(NH.old_coords(cat_to_mine(VN))).astype(f32)   # same feature on the old v11 head
DO = OH.parts_their((VO - H) / HS - 0.0)
for k in ('nose', 'muzzle', 'chin', 'cheeks', 'cran'):
    D[k] = (DO[k] * HS).astype(f32)
D['head'] = (DO['head'] * HS).astype(f32)
verts = VO
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
    q = (VN - EAR_BASE[i]) @ R.T
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
    de = np.linalg.norm(VN - e, axis=1) - EYE_R
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

# v13: the long cheek / jowl / throat fur no longer swallows the muzzle and chin in profile
mn_ = cat_to_mine(VN)
front_ = sstep(-0.020, -0.004, mn_[:, 0]) * sstep(-0.014, -0.022, mn_[:, 2]) * (1 - sstep(-0.064, -0.075, mn_[:, 2])) * (1 - sstep(0.009, 0.015, np.abs(mn_[:, 1])))
cap_ = 0.0060 + 0.030 * (1 - front_)
flen = np.minimum(flen, cap_)
# v13: a real cat's chin is short, close fur; it only grows longer toward the throat
chin_r = sstep(-0.032, -0.040, mn_[:, 2]) * (1 - sstep(-0.078, -0.090, mn_[:, 2])) * sstep(-0.045, -0.025, mn_[:, 0]) * (1 - sstep(0.011, 0.019, np.abs(mn_[:, 1])))
cap2 = 0.0040 + 0.0080 * sstep(-0.004, -0.030, mn_[:, 0])
flen = flen * (1 - chin_r) + np.minimum(flen, cap2) * chin_r
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
    de_ = VN - e
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
puff = w['muzzle'] * 0.0078 + w['chin'] * 0.0030 + w['cran'] * 0.0058 + w['cheeks'] * 0.0   # v13: no long puff on the chin
flen = np.maximum(flen, fw_ * puff * (1 - rim * 0.95))
# v9: fur right round the nose is very short, so the nose tip stays the front-most point instead of sinking into the muzzle puff
nshort = 0.22 + 0.78 * sstep(0.0012, 0.0085, D['nose'] / HS)
flen = flen * (1 - headw0 * (1 - nshort))
flen = np.minimum(flen, cap_)                                   # v13: muzzle sides / chin stay short after the puff
flen = np.where(mzone > 1.5, 0.0, flen)                         # v14: mouth pocket is bare lining
flen = flen * (1 - chin_r) + np.minimum(flen, cap2) * chin_r
nose_pt = H + OH.to_their(OH.NOSE_MINE) * HS
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

# ---------------- v11: lips ----------------
lipm = (1 - sstep(0.0003, 0.0012, dlip)).astype(f32)                 # thin dark lip edge, hidden in the crease at rest
lipshort = (0.8 - 0.8 * sstep(0.001, 0.008, dlip)).astype(f32)       # fur at the lips parts only while the mouth opens (shader)
mouth = lipm
# ---------------- v10: blink — the skin around each eye rolls over the eyeball ----------------
lidang = np.zeros(len(verts), f32); eyesel = np.zeros(len(verts), f32)
EYE_AX = []
best = np.full(len(verts), 1e9)
for i, s_ in enumerate((1, -1)):
    C = EYES[i]; f_, u_, o_ = EYE_FR[i]
    ax = np.cross(f_, u_); ax /= np.linalg.norm(ax); EYE_AX.append(ax)
    q = (VN - C) / KS                                    # mine metres
    a_ = q @ f_; b_ = q @ o_; c_ = q @ u_
    dist = np.linalg.norm(q, axis=1)
    bb = np.clip(b_, -0.97 * NH.AP_W, 0.97 * NH.AP_W)
    up_, lo_ = NH.lid_half(bb); cl_ = NH.lid_line(bb)
    Rl = NH.EYE_R + NH.LID_T
    def elev(cz):
        aa = np.sqrt(np.maximum(Rl * Rl - bb * bb - cz * cz, 1e-8))
        return np.arctan2(cz, aa)
    e_up, e_lo = elev(cl_ + up_), elev(cl_ - lo_)
    e_meet = e_lo + 0.30 * (e_up - e_lo)
    upper = c_ > cl_
    dang = np.where(upper, (e_meet - e_up) - 0.10, (e_meet - e_lo) + 0.02)
    wd = 1 - sstep(Rl + 0.0006, Rl + 0.012, dist)
    wb = 1 - sstep(NH.AP_W * 1.0, NH.AP_W * 1.55, np.abs(b_))
    wf = sstep(-0.004, 0.003, a_)                         # only the front half (lids), not the skull behind the globe
    val = dang * wd * wb * wf
    closer = dist < best
    lidang = np.where(closer & (wd > 0), val, lidang); eyesel = np.where(closer & (wd > 0), float(i), eyesel)
    best = np.where(closer, dist, best)
lidang = lidang.astype(f32)

# ---------------- AO ----------------
def sdf_scene(P):
    return np.minimum(sdf_total(P), P[:, 1] + 0.002)
ao = np.zeros(len(verts), f32)
sc = 1.0
for k, hh in enumerate([0.004, 0.009, 0.016, 0.026, 0.04]):
    dd = sdf_scene(VN + N * hh)
    ao += (hh - dd) * sc
    sc *= 0.7
ao = np.clip(1 - ao * 9.0, 0.15, 1.0)
ao = np.where(mzone > 1.5, 0.95 - 0.70 * pocket_depth, ao).astype(f32)   # v14: lining darkens toward the throat


# deformation weights
headdef = sstep(0.16, 0.207, x) * sstep(0.10, 0.135, y)
headdef = np.maximum(headdef, np.clip(headw + w['earL'] + w['earR'], 0, 1) * sstep(0.12, 0.15, y))
bodydef = np.clip(w['body'] + w['chest'] + w['neck'] * 0.5, 0, 1) * (1 - headdef) * sstep(0.03, 0.08, y)
tailw = istail * sstep(0.45, 1.0, tparam)
earLw = w['earL'] * sstep(-0.002, 0.01, ((VN - EAR_BASE[0]) @ EAR_R[0][1]))
earRw = w['earR'] * sstep(-0.002, 0.01, ((VN - EAR_BASE[1]) @ EAR_R[1][1]))

def b64(a, dt):
    return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode()

attrs = np.stack([flen, white, orange, skin, sparse, rim, mouth, ao, stripe], 1)
defw = np.stack([headdef, bodydef, tailw, earLw, earRw], 1)
pivot_i = int(round(0.45 * (TN - 1)))
REST = VO
def warp_cat(P):
    return mine_to_cat(NH.warp(cat_to_mine(P))).astype(f32)
J = np.zeros((len(VN), 3, 3), f32)
for i in range(3):
    dv = np.zeros(3, f32); dv[i] = 0.0005
    J[:, :, i] = (warp_cat(VN + dv) - warp_cat(VN - dv)) / 0.001
Jinv_T = np.transpose(np.linalg.inv(J), (0, 2, 1))
N = np.einsum('nij,nj->ni', Jinv_T, N); N /= np.linalg.norm(N, axis=1, keepdims=True)
comb = np.einsum('nij,nj->ni', J, comb); comb -= N * (comb * N).sum(1, keepdims=True); comb /= np.maximum(np.linalg.norm(comb, axis=1, keepdims=True), 1e-6)
verts = warp_cat(VN)
def wpt(v): return warp_cat(np.asarray(v, f32)[None])[0].tolist()
out = dict(rest=b64(REST, '<f4'),
    pos=b64(verts, '<f4'), nrm=b64(N, '<f4'), comb=b64(comb, '<f4'),
    attr=b64(attrs, '<f4'), defw=b64(defw, '<f4'), idx=b64(faces, '<u4'),
    face=b64(np.stack([JW, lidang, eyesel, mzone], 1), '<f4'), tng=b64(np.zeros(len(verts), f32), '<f4'), lip=b64(lipshort, '<f4'),
    nv=len(verts), nf=len(faces),
    meta=dict(H=H.tolist(), eyes=[e.tolist() for e in EYES], eyeR=EYE_R,
              earBase=[e.tolist() for e in EAR_BASE], earAxes=[R.tolist() for R in EAR_R],
              neck=NECK_PIVOT.tolist(), tailPivot=TAIL[pivot_i].tolist(),
              tailTan=(TAIL[pivot_i + 1] - TAIL[pivot_i - 1]).tolist(),
              tailTip=TAIL[-1].tolist(),
              pads=[wpt(H + NH.to_their(NH.PAD_MINE * np.array([1, -s, 1])) * HS) for s in (1, -1)],
              nose=wpt(H + NH.to_their(NH.NOSE_MINE) * HS), HS=HS,
              eyeGaze=[EYE_FR[i][0].tolist() for i in range(2)], eyeUp=[EYE_FR[i][1].tolist() for i in range(2)],
              eyeAx=[EYE_AX[i].tolist() for i in range(2)], hinge=HINGE_CAT.tolist(),
              teeth=[dict(b=wpt(t['b']), t=wpt(t['t']), r=t['r'], jaw=t['jaw']) for t in TEETH12],
              # mouth cavity (an ellipsoid split at the cut: dome = upper jaw, bowl = lower jaw) and tongue, cat frame
              tongueC=wpt(TONGUE_C), tongueR=TONGUE_R))
json.dump(out, open('cat_data.json', 'w'))
print('stats len', flen.min(), flen.max(), 'ao', ao.min(), ao.mean(), 'white', white.mean())
trimesh.Trimesh(verts, faces, process=False).export('cat_base.obj')
print('lip edge', len(bverts), 'jaw', int((JW > 0.5).sum()), 'mouth zone', int(mzone.sum()), 'lid', int((np.abs(lidang) > 0.01).sum()))
