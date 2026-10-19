# Reference head pipeline (v12)

Turns the user's reference cat model (Fripouille, FBX, supplied by the user) into the signed-distance grid
`ref_head_sdf.npz` that `newhead12.py` reads. Shape only: no colours or textures are taken from it.

The reference model, the grid and the built page `cat-tent-v12.html` are **not** in the repository: the reference model's
licence is unconfirmed and this repository is public. Run the steps locally with the FBX:

1. `fbx_to_obj.html` + `fbx_to_obj.cjs` (three.js FBXLoader in headless Chromium, served from a folder that holds
   `node_modules/three` and `ref/frip_F_export.fbx`) → `ref/frip.obj`.
2. `python ref_frame.py web/ref/frip.obj` → `frame.npz` (face frame from the two eyeballs).
3. `python step3_subdivide_and_frame.py` → `ref12/ref_mine.ply` (welded, Loop-subdivided twice, in the head frame)
   and a first grid (its sign is unreliable at the thin mouth slit; step 4 replaces it).
4. `python step4_parity_sdf.py` → `ref12/ref_sdf2.npz` (sign from vertical-ray parity, distance from a dense surface sample).
5. `python step5_close_slit.py` → `work/ref_head_sdf.npz`.

Then `python gen_cat12.py 90000` and `python build12.py cat_data.json` (see the main README).
