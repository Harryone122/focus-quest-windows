"""Reference head shape -> signed distance grid in the cat head's 'mine' frame (x fwd, y left, z up, metres,
origin between the eye centres shifted by EYE_X, eye distance = 2*EYE_Y). Shape only: no colours are taken."""
import numpy as np, trimesh, sys, time
from scipy.spatial import cKDTree
sys.path.insert(0, 'work')
import newhead11 as NH
t0 = time.time()
sc = trimesh.load('web/ref/frip.obj', force='scene', process=False)
hp = max(sc.geometry.values(), key=lambda g: len(g.vertices))
mesh = trimesh.Trimesh(hp.vertices, hp.faces, process=True)
mesh.fix_normals()   # consistent outward winding (the reference mouth pocket had flipped faces)
f = np.load('web/ref/frame.npz'); M, fw, up, lat = f['m'], f['fw'], f['up'], f['lat']
IODr = np.linalg.norm(f['c'][1] - f['c'][0]); IOD = 2 * NH.EYE_Y
V = mesh.vertices - M
mine = np.stack([V @ fw, V @ lat, V @ up], 1) / IODr * IOD + np.array([NH.EYE_X, 0, 0])
mesh = trimesh.Trimesh(mine, mesh.faces, process=False)
for _ in range(2):
    v, fc = trimesh.remesh.subdivide_loop(mesh.vertices, mesh.faces)
    mesh = trimesh.Trimesh(v, fc, process=False)
print('subdivided', len(mesh.vertices), len(mesh.faces), round(time.time() - t0, 1))
mesh.export('ref12/ref_mine.ply')
pts, fid = trimesh.sample.sample_surface(mesh, 1600000, seed=3)
nrm = mesh.face_normals[fid]
tree = cKDTree(pts)
lo = np.array([-0.075, -0.066, -0.085]); hi = np.array([0.058, 0.066, 0.062]); step = 0.0008
axes = [np.arange(lo[i], hi[i] + 1e-9, step) for i in range(3)]
axes[1] = np.linspace(-0.066, 0.066, int(round(0.132 / step)) + 1)        # symmetric about y = 0
G = np.empty([len(a) for a in axes], np.float32)
for ix, x in enumerate(axes[0]):
    Y, Z = np.meshgrid(axes[1], axes[2], indexing='ij')
    P = np.stack([np.full_like(Y, x), Y, Z], -1).reshape(-1, 3)
    d, i = tree.query(P, k=1)
    s = np.sign(((P - pts[i]) * nrm[i]).sum(1)); s[s == 0] = 1
    G[ix] = (d * s).reshape(Y.shape)
G = 0.5 * (G + G[:, ::-1, :])
np.savez_compressed('ref12/ref_sdf.npz', G=G, x=axes[0], y=axes[1], z=axes[2])
print('grid', G.shape, 'done', round(time.time() - t0, 1), 's')
