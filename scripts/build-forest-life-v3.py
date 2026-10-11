from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(r"C:\Users\User\Downloads\map")
OUTPUT_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-life-v3"
PREVIEW_ROOT = ROOT / "previews"
PHASES = ("morning", "noon", "afternoon", "night")
CANVAS = (1672, 941)


# The broad source cut-outs are contaminated with hard scenery. These compact,
# intentionally overlapping work areas are assigned in order; a pixel can only
# belong to one final layer. This keeps each animated sprite local and prevents
# stone paths, pillars, the astrolabe, and the arch from moving with the grass.
GRASS_REGIONS: tuple[tuple[str, tuple[int, int, int, int]], ...] = (
    ("grass_astrolabe_west", (160, 185, 470, 535)),
    ("grass_astrolabe_east", (430, 185, 735, 550)),
    ("grass_left_ruins", (0, 280, 330, 645)),
    ("grass_center_path_west", (560, 305, 845, 665)),
    ("grass_center_path_east", (805, 275, 1115, 665)),
    ("grass_archive_arch_base", (965, 105, 1290, 510)),
    ("grass_right_upper_path", (1220, 0, 1672, 465)),
    ("grass_bridge_edge", (1040, 445, 1672, 850)),
    ("grass_lower_left_stairs", (0, 575, 760, 941)),
)

VINE_REGIONS: tuple[tuple[str, tuple[int, int, int, int]], ...] = (
    ("vines_west", (0, 0, 360, 670)),
    ("vines_astrolabe", (320, 0, 710, 625)),
    ("vines_center_bridge", (650, 250, 1010, 941)),
    ("vines_archive_arch", (930, 0, 1300, 700)),
    ("vines_east", (1240, 0, 1672, 790)),
    ("vines_lower_stairs", (0, 570, 850, 941)),
)


def open_rgba(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != CANVAS:
        raise RuntimeError(f"Unexpected canvas for {path}: {image.size}")
    return image


def maximum_alpha_composite(images: list[Image.Image]) -> Image.Image:
    arrays = np.stack([np.asarray(image, dtype=np.uint8) for image in images], axis=0)
    alpha = arrays[:, :, :, 3]
    winner = np.argmax(alpha, axis=0)
    rows, columns = np.indices(winner.shape)
    return Image.fromarray(arrays[winner, rows, columns], mode="RGBA")


def clean_green_mask(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8)
    red = rgba[:, :, 0].astype(np.int16)
    green = rgba[:, :, 1].astype(np.int16)
    blue = rgba[:, :, 2].astype(np.int16)
    alpha = rgba[:, :, 3]

    # Deliberately conservative: missing a few yellow tips is less harmful than
    # rotating a stone edge. The noon mask is reused for every phase so the
    # geometry never changes during the four-way daylight crossfade.
    is_plant = (
        (alpha > 12)
        & (green - red > 10)
        & (green - blue > 20)
        & (green > 28)
    )
    mask = np.where(is_plant, alpha, 0).astype(np.uint8)
    return Image.fromarray(mask, mode="L").filter(ImageFilter.MedianFilter(3))


def region_mask(base_mask: Image.Image, rectangle: tuple[int, int, int, int], used: Image.Image) -> Image.Image:
    region = Image.new("L", CANVAS, 0)
    ImageDraw.Draw(region).rectangle(rectangle, fill=255)
    available = ImageChops.subtract(base_mask, used)
    return ImageChops.multiply(available, region)


def save_cutout(source: Image.Image, mask: Image.Image, output: Path) -> dict[str, int]:
    bbox = mask.getbbox()
    if bbox is None:
        raise RuntimeError(f"No visible plant pixels for {output.stem}")
    x0, y0, x1, y1 = bbox
    crop = source.crop(bbox)
    crop.putalpha(mask.crop(bbox))
    output.parent.mkdir(parents=True, exist_ok=True)
    crop.save(output, optimize=True)
    return {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}


def build_mid_fog(far: Image.Image, near: Image.Image) -> Image.Image:
    far_array = np.asarray(far, dtype=np.float32)
    near_array = np.asarray(near, dtype=np.float32)
    mixed = far_array * 0.58 + near_array * 0.42
    mixed[:, :, 3] *= 0.72
    image = Image.fromarray(np.clip(mixed, 0, 255).astype(np.uint8), mode="RGBA")
    return image.filter(ImageFilter.GaussianBlur(2.4))


def main() -> None:
    vegetation_root = SOURCE_ROOT / "DYNAMIC_VEGETATION" / "TIME_GRADED"
    atmosphere_root = SOURCE_ROOT / "ATMOSPHERE" / "TIME_GRADED"
    for phase in PHASES:
        for stale_name in ("grass_bridge_west.png", "grass_bridge_east.png"):
            stale = OUTPUT_ROOT / phase / "vegetation" / stale_name
            if stale.is_file() and OUTPUT_ROOT in stale.resolve().parents:
                stale.unlink()

    noon_grass = maximum_alpha_composite([
        open_rgba(vegetation_root / "noon" / f"grass_{name}.png")
        for name in ("left", "center", "right")
    ])
    noon_vines = open_rgba(vegetation_root / "noon" / "vines_all.png")
    grass_base_mask = clean_green_mask(noon_grass)
    vine_base_mask = clean_green_mask(noon_vines)

    grass_masks: dict[str, Image.Image] = {}
    vine_masks: dict[str, Image.Image] = {}
    used_grass = Image.new("L", CANVAS, 0)
    used_vines = Image.new("L", CANVAS, 0)
    for name, rectangle in GRASS_REGIONS:
        mask = region_mask(grass_base_mask, rectangle, used_grass)
        grass_masks[name] = mask
        used_grass = ImageChops.lighter(used_grass, mask)
    for name, rectangle in VINE_REGIONS:
        mask = region_mask(vine_base_mask, rectangle, used_vines)
        vine_masks[name] = mask
        used_vines = ImageChops.lighter(used_vines, mask)

    manifest: dict[str, object] = {
        "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
        "grass": {},
        "vines": {},
        "atmosphere": {"fog_mid": {"x": 0, "y": 0, "width": CANVAS[0], "height": CANVAS[1]}},
        "sourceAudit": {
            "disabledBroadLayers": ["grass_left", "grass_center", "grass_right", "vines_all"],
            "reason": "Broad alpha cut-outs contain paths, pillars, arch masonry, plaza stones, and the astrolabe."
        }
    }

    phase_sources: dict[str, tuple[Image.Image, Image.Image]] = {}
    for phase in PHASES:
        phase_grass = maximum_alpha_composite([
            open_rgba(vegetation_root / phase / f"grass_{name}.png")
            for name in ("left", "center", "right")
        ])
        phase_vines = open_rgba(vegetation_root / phase / "vines_all.png")
        phase_sources[phase] = (phase_grass, phase_vines)

    for phase, (phase_grass, phase_vines) in phase_sources.items():
        for name, mask in grass_masks.items():
            bounds = save_cutout(phase_grass, mask, OUTPUT_ROOT / phase / "vegetation" / f"{name}.png")
            if phase == "noon":
                manifest["grass"][name] = {
                    **bounds,
                    "pivot": {"x": bounds["x"] + bounds["width"] / 2, "y": bounds["y"] + bounds["height"] - 1},
                    "motion": "bottom-fixed sway"
                }
        for name, mask in vine_masks.items():
            bounds = save_cutout(phase_vines, mask, OUTPUT_ROOT / phase / "vegetation" / f"{name}.png")
            if phase == "noon":
                manifest["vines"][name] = {
                    **bounds,
                    "pivot": {"x": bounds["x"] + bounds["width"] / 2, "y": bounds["y"] + 1},
                    "motion": "top-fixed sway"
                }

        far = open_rgba(atmosphere_root / phase / "fog_far.png")
        near = open_rgba(atmosphere_root / phase / "fog_near.png")
        fog_mid = build_mid_fog(far, near)
        fog_output = OUTPUT_ROOT / phase / "atmosphere" / "fog_mid.png"
        fog_output.parent.mkdir(parents=True, exist_ok=True)
        fog_mid.save(fog_output, optimize=True)

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # QA sheet: every moving grass/vine pixel is color coded over the noon
    # clean plate. Any colored stone is a cut-out defect and must be fixed.
    static = open_rgba(SOURCE_ROOT / "STATIC" / "static_noon.png")
    overlay = static.copy()
    colors = [
        (255, 79, 54, 205), (43, 210, 167, 205), (255, 191, 64, 205),
        (153, 109, 255, 205), (65, 154, 255, 205), (255, 105, 180, 205),
    ]
    for index, (name, mask) in enumerate({**grass_masks, **vine_masks}.items()):
        color = colors[index % len(colors)]
        tint = Image.new("RGBA", CANVAS, color)
        tint.putalpha(mask.point(lambda value, alpha=color[3]: min(alpha, value)))
        overlay.alpha_composite(tint)
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    overlay.save(PREVIEW_ROOT / "forest-life-v3-layer-audit.png")

    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
