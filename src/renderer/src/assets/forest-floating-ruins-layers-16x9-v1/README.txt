Focus Quest — Forest Dynamic Layers 16:9

This ZIP contains the latest 16:9 forest-scene dynamic layers generated for the test build.

Files:
- foreground_left.png  : left foreground foliage / occlusion layer
- foreground_right.png : right foreground foliage / occlusion layer
- canopy_left.png      : left canopy layer for subtle wind sway
- canopy_center.png    : central canopy layer for subtle wind sway
- vines.png            : hanging vines for wind animation
- fog_near.png         : near fog / cloud layer
- fog_far.png          : far fog / atmospheric layer
- shadow_mask.png      : stylized dynamic shadow proxy layer
- leaf_particles.png   : sparse leaf particle sprites

Suggested Phaser use:
- canopy: very small sway, different phase per layer
- vines: slightly larger sway than canopy
- near fog: slow horizontal drift
- far fog: slower parallax drift
- shadow mask: low opacity and continuous transform with daylight phase
- leaf particles: sparse, non-glowing, low density

These are prototype compositing assets and should be aligned against the current forest base scene.
