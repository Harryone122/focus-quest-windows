"""Step 2: face frame of the reference cat (from its two eyeballs): origin between the eye centroids, fw = forward,
lat = from eye 0 to eye 1, up = world up. Writes frame.npz next to the exported OBJ (web/ref/)."""
import numpy as np, trimesh, sys
obj = sys.argv[1] if len(sys.argv) > 1 else 'web/ref/frip.obj'
sc = trimesh.load(obj, force='scene', process=False)
eyes = [g for g in sc.geometry.values() if len(g.vertices) == 3264][0]       # the two eyeball caps
hp = max(sc.geometry.values(), key=lambda g: len(g.vertices))
E = np.asarray(eyes.vertices)
c = np.array([E[E[:, 2].argmin()], E[E[:, 2].argmax()]])
for _ in range(20):
    lab = np.linalg.norm(E[:, None] - c[None], axis=2).argmin(1); c = np.array([E[lab == i].mean(0) for i in range(2)])
m = c.mean(0); lat = c[1] - c[0]; lat /= np.linalg.norm(lat)
up = np.array([0, 1.0, 0]); up -= lat * (up @ lat); up /= np.linalg.norm(up)
fw = np.cross(lat, up); fw /= np.linalg.norm(fw)
if fw[0] < 0: fw = -fw                                                      # the face looks toward +x in this file
np.savez(obj.replace('frip.obj', 'frame.npz'), m=m, fw=fw, up=up, lat=lat, c=c)
print('eye distance', np.linalg.norm(c[1] - c[0]))
