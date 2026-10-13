# Fixed lake shoreline pixels

`groundPixels.base64.txt` contains the exact RGBA bytes produced by the original
`groundTex` procedural sampler in `reflectionLakeScene.js` (0.6.31), captured
from its production Three.js `DataTexture` on 2026-10-13. It is not a redesigned
map. Width 768, height 672, 2,064,384 bytes, row order unchanged.

Decoded SHA-256: `6f09e468d4c5e531aabe32c5eb421f344701823146597586fe225da9f3e6c713`.

This removes the same deterministic, expensive shoreline computation on every
map entry. Each renderer still owns and disposes its own GPU texture; the shared
CPU bytes are immutable. If `MAPB` or the `FE` terrain shapes change, rebake this
asset using the original sampler from Git, and compare pixels before replacing
it. Geometry, tide, and traveller routes remain live scene data.

Evidence: `previews/map-switch-qa/ground-pixels.json` is the isolated runtime
capture used for the bake; the decoded asset is byte-for-byte identical.
