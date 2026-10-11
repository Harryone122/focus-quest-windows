Focus Quest — Forest Map Dynamic Layers v1

Included assets
---------------
foreground_left.png
  Left-side foreground foliage / occlusion layer.

foreground_right.png
  Right-side foreground foliage / occlusion layer.

canopy_left.png
  Left tree canopy / foliage layer for subtle wind sway.

canopy_center.png
  Main central tree canopy / foliage layer for subtle wind sway.

vines.png
  Hanging vines / trailing plants for wind animation.

fog_near.png
  Near fog layer for slow drift.

fog_far.png
  Far fog / cloud-sea layer for slower parallax drift.

landmarks.png
  Key landmark objects: observatory / stone tablet / chest.

shadow_mask.png
  Stylized major-object shadow overlay for time-of-day transforms.

leaf_particles.png
  Sparse leaf sprite sheet for low-density wind particles.

Notes
-----
- These are transparent PNG assets generated as a first-pass prototype set.
- They are intended for Phaser compositing and subtle motion, not for large deformation.
- Suggested motion:
  * canopy: ~0.3–1.0 deg slow sway
  * vines: ~1–3 deg / small x offset
  * near fog: slow horizontal drift
  * far fog: even slower parallax drift
  * leaf particles: very sparse
  * shadow_mask: low-opacity transform / offset / scale as daylight changes
- Avoid excessive glow, white specks, or dense particle effects.
- Keep the four morning/noon/afternoon/night base scenes as the main daylight keyframes.
