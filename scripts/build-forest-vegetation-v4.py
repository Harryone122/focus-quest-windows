from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(r"C:\Users\User\Downloads\map")
REFERENCE_ROOT = SOURCE_ROOT / "SOURCE_REFERENCE"
V2_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-dynamic-v2"
V3_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-life-v3"
OUTPUT_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-vegetation-v4"
PREVIEW_ROOT = ROOT / "previews"

PHASES = ("morning", "noon", "afternoon", "night")
CANVAS = (1672, 941)


def open_rgba(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != CANVAS:
        raise RuntimeError(f"Unexpected canvas for {path}: {image.size}")
    return image


def open_crop(path: Path, size: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != size:
        raise RuntimeError(f"Unexpected crop for {path}: {image.size}, expected {size}")
    return image


def load_manifest(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def bounds_tuple(data: dict[str, int]) -> tuple[int, int, int, int]:
    x = int(data["x"])
    y = int(data["y"])
    width = int(data["width"])
    height = int(data["height"])
    return x, y, width, height


def clean_canopy_alpha(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8)
    hsv = np.asarray(image.convert("HSV"), dtype=np.uint8)
    red = rgba[:, :, 0].astype(np.int16)
    green = rgba[:, :, 1].astype(np.int16)
    blue = rgba[:, :, 2].astype(np.int16)
    alpha = rgba[:, :, 3]
    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]

    # The clean plate already owns trunks, branches, stone and sky. Canopy
    # sprites therefore retain only yellow-green through muted blue-green leaf
    # pixels. This removes the rectangular sky/trunk remnants present in the
    # earlier broad canopy exports without changing the authored leaf edges.
    is_leaf = (
        (alpha > 18)
        & (hue >= 22)
        & (hue <= 112)
        & (saturation >= 34)
        & (green >= red * 0.68)
        & (green >= blue * 0.84)
    )
    leaf_alpha = np.where(is_leaf, alpha, 0).astype(np.uint8)
    mask = Image.fromarray(leaf_alpha, mode="L").filter(ImageFilter.MedianFilter(3))
    return ImageChops.multiply(mask, image.getchannel("A"))


def build_alpha_templates() -> tuple[dict[str, Image.Image], dict[str, tuple[int, int, int, int]]]:
    v2_manifest = load_manifest(V2_ROOT / "manifest.json")
    v3_manifest = load_manifest(V3_ROOT / "manifest.json")
    templates: dict[str, Image.Image] = {}
    bounds: dict[str, tuple[int, int, int, int]] = {}

    canopy_entries = v2_manifest["vegetation"]
    canopy_candidates: dict[str, Image.Image] = {}
    for filename, raw in canopy_entries.items():
        name = Path(str(filename)).stem
        if not name.startswith("tree_canopy_"):
            continue
        bbox = raw["bbox"]
        x0, y0, x1, y1 = (int(value) for value in bbox)
        crop_bounds = (x0, y0, x1 - x0, y1 - y0)
        source = open_crop(V2_ROOT / "noon" / "vegetation" / f"{name}.png", crop_bounds[2:])
        canopy_candidates[str(name)] = clean_canopy_alpha(source)
        bounds[str(name)] = crop_bounds

    # Canopy crops intentionally overlap. Assign every leaf pixel to exactly
    # one sprite so independently moving crowns never double-render or reveal a
    # rectangular seam.
    canopy_names = sorted(canopy_candidates)
    full_candidates: list[np.ndarray] = []
    for name in canopy_names:
        x, y, width, height = bounds[name]
        full = np.zeros((CANVAS[1], CANVAS[0]), dtype=np.uint8)
        full[y:y + height, x:x + width] = np.asarray(canopy_candidates[name], dtype=np.uint8)
        full_candidates.append(full)
    stack = np.stack(full_candidates, axis=0)
    winners = np.argmax(stack, axis=0)
    strongest = np.max(stack, axis=0)
    for index, name in enumerate(canopy_names):
        x, y, width, height = bounds[name]
        assigned = np.where((winners == index) & (strongest > 0), stack[index], 0).astype(np.uint8)
        templates[name] = Image.fromarray(assigned[y:y + height, x:x + width], mode="L")

    for section in ("grass", "vines"):
        entries = v3_manifest[section]
        for name, raw in entries.items():
            crop_bounds = bounds_tuple(raw)
            source = open_crop(V3_ROOT / "noon" / "vegetation" / f"{name}.png", crop_bounds[2:])
            templates[str(name)] = source.getchannel("A")
            bounds[str(name)] = crop_bounds

    return templates, bounds


def recolor_from_reference(
    reference: Image.Image,
    alpha: Image.Image,
    bounds: tuple[int, int, int, int]
) -> Image.Image:
    x, y, width, height = bounds
    crop = reference.crop((x, y, x + width, y + height)).convert("RGBA")
    crop.putalpha(alpha)
    return crop


def composite_phase(
    static: Image.Image,
    phase: str,
    asset_ids: list[str],
    bounds: dict[str, tuple[int, int, int, int]],
    root: Path
) -> Image.Image:
    composite = static.copy()
    for asset_id in asset_ids:
        x, y, width, height = bounds[asset_id]
        layer = open_crop(root / phase / "vegetation" / f"{asset_id}.png", (width, height))
        composite.alpha_composite(layer, (x, y))
    return composite


def color_error(reference: Image.Image, reconstructed: Image.Image, mask: Image.Image) -> float:
    ref = np.asarray(reference.convert("RGB"), dtype=np.float32)
    test = np.asarray(reconstructed.convert("RGB"), dtype=np.float32)
    active = np.asarray(mask, dtype=np.uint8) > 8
    if not np.any(active):
        return 0.0
    return float(np.mean(np.abs(ref[active] - test[active])))


def build_contact_sheet(rows: list[tuple[str, Image.Image, Image.Image, Image.Image]]) -> None:
    thumb_width = 558
    thumb_height = 314
    label_height = 32
    sheet = Image.new("RGB", (thumb_width * 3, (thumb_height + label_height) * len(rows)), (11, 16, 19))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for row, (phase, reference, previous, corrected) in enumerate(rows):
        y = row * (thumb_height + label_height)
        for column, (label, image) in enumerate((
            (f"{phase} reference", reference),
            (f"{phase} previous", previous),
            (f"{phase} corrected v4", corrected),
        )):
            x = column * thumb_width
            thumb = image.convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x, y))
            draw.text((x + 10, y + thumb_height + 9), label, fill=(218, 222, 213), font=font)
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_ROOT / "forest-vegetation-v4-color-match.png", quality=94)


def build_layer_audit(
    reference: Image.Image,
    alpha_templates: dict[str, Image.Image],
    bounds: dict[str, tuple[int, int, int, int]],
) -> None:
    groups = (
        ("canopies", [asset_id for asset_id in alpha_templates if asset_id.startswith("tree_canopy_")]),
        ("grass", [asset_id for asset_id in alpha_templates if asset_id.startswith("grass_")]),
        ("vines", [asset_id for asset_id in alpha_templates if asset_id.startswith("vines_")]),
    )
    colors = (
        (232, 91, 91),
        (101, 210, 151),
        (92, 155, 232),
        (226, 189, 82),
        (183, 111, 220),
        (74, 208, 208),
        (239, 133, 73),
        (143, 176, 71),
        (110, 116, 222),
    )
    panels: list[tuple[str, Image.Image]] = []
    dimmed = Image.blend(reference.convert("RGBA"), Image.new("RGBA", CANVAS, (4, 9, 13, 255)), 0.62)
    for group_name, asset_ids in groups:
        overlay = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        for index, asset_id in enumerate(sorted(asset_ids)):
            x, y, _, _ = bounds[asset_id]
            alpha = alpha_templates[asset_id].point(lambda value: int(value * 0.72))
            swatch = Image.new("RGBA", alpha.size, (*colors[index % len(colors)], 0))
            swatch.putalpha(alpha)
            overlay.alpha_composite(swatch, (x, y))
        panel = dimmed.copy()
        panel.alpha_composite(overlay)
        panels.append((group_name, panel))

    label_height = 32
    sheet = Image.new("RGB", (CANVAS[0], (CANVAS[1] + label_height) * len(panels)), (11, 16, 19))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (label, panel) in enumerate(panels):
        y = index * (CANVAS[1] + label_height)
        sheet.paste(panel.convert("RGB"), (0, y))
        draw.text((12, y + CANVAS[1] + 9), f"v4 moving-mask audit: {label}", fill=(218, 222, 213), font=font)
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_ROOT / "forest-vegetation-v4-mask-audit.png", quality=94)


def main() -> None:
    alpha_templates, bounds = build_alpha_templates()
    asset_ids = sorted(alpha_templates)
    union_mask = Image.new("L", CANVAS, 0)

    for asset_id in asset_ids:
        x, y, _, _ = bounds[asset_id]
        existing = union_mask.crop((x, y, x + alpha_templates[asset_id].width, y + alpha_templates[asset_id].height))
        union_mask.paste(ImageChops.lighter(existing, alpha_templates[asset_id]), (x, y))

    rows: list[tuple[str, Image.Image, Image.Image, Image.Image]] = []
    errors: dict[str, float] = {}
    for phase in PHASES:
        reference = open_rgba(REFERENCE_ROOT / f"static_{phase}.png")
        for asset_id in asset_ids:
            output = recolor_from_reference(reference, alpha_templates[asset_id], bounds[asset_id])
            output_path = OUTPUT_ROOT / phase / "vegetation" / f"{asset_id}.png"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output.save(output_path, optimize=True)

        static = open_rgba(V2_ROOT / "static" / f"{phase}.png")
        corrected = composite_phase(static, phase, asset_ids, bounds, OUTPUT_ROOT)

        # The old comparison intentionally mirrors the production mix before v4.
        previous = static.copy()
        for asset_id in asset_ids:
            x, y, width, height = bounds[asset_id]
            source_root = V2_ROOT if asset_id.startswith("tree_canopy_") else V3_ROOT
            layer = open_crop(source_root / phase / "vegetation" / f"{asset_id}.png", (width, height))
            previous.alpha_composite(layer, (x, y))

        errors[phase] = color_error(reference, corrected, union_mask)
        rows.append((phase, reference, previous, corrected))

    manifest = {
        "version": 4,
        "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
        "phases": list(PHASES),
        "strategy": "Stable noon alpha masks with RGB sampled from each authored phase reference.",
        "invariants": [
            "identical crop bounds and alpha geometry in every phase",
            "no static scenery is regenerated or recolored",
            "daylight crossfade changes color without changing plant silhouettes",
        ],
        "assets": {
            asset_id: {
                "x": bounds[asset_id][0],
                "y": bounds[asset_id][1],
                "width": bounds[asset_id][2],
                "height": bounds[asset_id][3],
            }
            for asset_id in asset_ids
        },
        "meanVegetationColorError": errors,
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    build_contact_sheet(rows)
    build_layer_audit(open_rgba(REFERENCE_ROOT / "static_noon.png"), alpha_templates, bounds)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
