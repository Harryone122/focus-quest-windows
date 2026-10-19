"""Reference head shape -> signed distance grid (shape only). Sign from vertical-ray parity (robust to the thin mouth slit),
magnitude from the nearest point of a dense surface sample."""
import numpy as np, trimesh, time
from scipy.spatial import cKDTree
t0 = time.time()
mesh = trimesh.load('ref12/ref_mine.ply', process=False)
R = np.load('ref12/ref_sdf.npz'); xa, ya, za = R['x'], R['y'], R['z']
step = xa[1] - xa[0]
T = mesh.triangles
# --- occupancy by parity of crossings along +z for every (x, y) column (columns jittered off the grid lines)
jx, jy = 0.137e-6, 0.291e-6
X0, Y0 = xa[0] + jx, ya[0] + jy
mn = T[:, :, :2].min(1); mx = T[:, :, :2].max(1)
i0 = np.ceil((mn[:, 0] - X0) / step).astype(int); i1 = np.floor((mx[:, 0] - X0) / step).astype(int)
j0 = np.ceil((mn[:, 1] - Y0) / step).astype(int); j1 = np.floor((mx[:, 1] - Y0) / step).astype(int)
cols, zs = [], []
span = int(max((i1 - i0).max(), (j1 - j0).max())) + 1
for a in range(span):
    for b in range(span):
        ii = i0 + a; jj = j0 + b
        sel = (ii <= i1) & (jj <= j1) & (ii >= 0) & (jj >= 0) & (ii < len(xa)) & (jj < len(ya))
        if not sel.any(): continue
        t = T[sel]; px = X0 + ii[sel] * step; py = Y0 + jj[sel] * step
        v0, v1, v2 = t[:, 0], t[:, 1], t[:, 2]
        d = (v1[:, 0] - v0[:, 0]) * (v2[:, 1] - v0[:, 1]) - (v2[:, 0] - v0[:, 0]) * (v1[:, 1] - v0[:, 1])
        ok = np.abs(d) > 1e-18
        l1 = ((px - v0[:, 0]) * (v2[:, 1] - v0[:, 1]) - (v2[:, 0] - v0[:, 0]) * (py - v0[:, 1])) / np.where(ok, d, 1)
        l2 = ((v1[:, 0] - v0[:, 0]) * (py - v0[:, 1]) - (px - v0[:, 0]) * (v1[:, 1] - v0[:, 1])) / np.where(ok, d, 1)
        inside = ok & (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
        z = v0[:, 2] + l1 * (v1[:, 2] - v0[:, 2]) + l2 * (v2[:, 2] - v0[:, 2])
        cols.append((ii[sel] * len(ya) + jj[sel])[inside]); zs.append(z[inside])
cols = np.concatenate(cols); zs = np.concatenate(zs)
order = np.lexsort((zs, cols)); cols = cols[order]; zs = zs[order]
occ = np.zeros((len(xa), len(ya), len(za)), bool)
starts = np.searchsorted(cols, np.unique(cols))
ucols = np.unique(cols)
ends = np.append(starts[1:], len(cols))
for c, s, e in zip(ucols, starts, ends):
    zc = zs[s:e]
    n = np.searchsorted(zc, za)               # crossings below each grid z
    occ[c // len(ya), c % len(ya)] = (n % 2) == 1
print('occupancy', occ.sum(), 'odd columns', int(sum(((e - s) % 2) for s, e in zip(starts, ends))), round(time.time() - t0, 1), 's')
# --- magnitude
pts, fid = trimesh.sample.sample_surface(mesh, 1600000, seed=3)
tree = cKDTree(pts)
G = np.empty(occ.shape, np.float32)
for ix, x in enumerate(xa):
    Y, Z = np.meshgrid(ya, za, indexing='ij')
    P = np.stack([np.full_like(Y, x), Y, Z], -1).reshape(-1, 3)
    d, _ = tree.query(P, k=1)
    G[ix] = np.where(occ[ix].ravel(), -d, d).reshape(Y.shape)
G = 0.5 * (G + G[:, ::-1, :])
np.savez_compressed('ref12/ref_sdf2.npz', G=G, x=xa, y=ya, z=za)
print('done', round(time.time() - t0, 1), 's')
