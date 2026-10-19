"""Step 5: close the reference mouth slit (the lips meet at rest; the yawn cuts its own opening) -> work/ref_head_sdf.npz."""
import numpy as np
from scipy import ndimage as ndi
R = np.load('ref12/ref_sdf2.npz'); G, xa, ya, za = R['G'], R['x'], R['y'], R['z']
occ = G < 0
ball = lambda r: (np.add.outer(np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2), np.arange(-r, r + 1) ** 2) <= r * r)
occ2 = ndi.binary_closing(occ, structure=ball(2)) | occ
G2 = np.where(occ2 & ~occ, np.minimum(G, -0.0003), G).astype(np.float32)
np.savez_compressed('work/ref_head_sdf.npz', G=G2, x=xa, y=ya, z=za)
