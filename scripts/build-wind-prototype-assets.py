from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REFERENCE_ROOT = Path(r"C:\Users\User\Downloads\map\SOURCE_REFERENCE")
DYNAMIC_ROOT = Path(r"C:\Users\User\Downloads\map\DYNAMIC_VEGETATION")
STATIC_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-dynamic-v2" / "static"
V4_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-vegetation-v4"
OUTPUT_ROOT = ROOT / "src" / "renderer" / "src" / "assets" / "forest-wind-prototype-v1"
PREVIEW_ROOT = ROOT / "previews"

PHASES = ("morning", "noon", "afternoon", "night")
CANVAS = (1672, 941)


@dataclass(frozen=True)
class PrototypeRegion:
    id: str
    kind: str
    x: int
    y: int
    width: int
    height: int
    columns: int
    rows: int
    phase_offset: float
    tip_displacement: float


# Each crop is deliberately small and contains one local motion study only.
REGIONS = (
    PrototypeRegion("grass_path_tuft", "grass", 1015, 466, 72, 51, 6, 4, 0.15, 3.2),
    PrototypeRegion("vine_lower_stair_strand", "vine", 344, 792, 42, 136, 3, 8, 0.72, 5.2),
    PrototypeRegion("canopy_center_edge", "canopy", 832, 160, 150, 88, 7, 5, 1.24, 3.6),
)


def open_rgba(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != CANVAS:
        raise RuntimeError(f"Unexpected canvas for {path}: {image.size}")
    return image


def vegetation_mask(reference: Image.Image, static: Image.Image, region: PrototypeRegion) -> Image.Image:
    box = (region.x, region.y, region.x + region.width, region.y + region.height)
    source = reference.crop(box).convert("RGBA")
    clean = static.crop(box).convert("RGBA")
    rgba = np.asarray(source, dtype=np.uint8)
    hsv = np.asarray(source.convert("HSV"), dtype=np.uint8)
    clean_rgb = np.asarray(clean.convert("RGB"), dtype=np.int16)
    source_rgb = rgba[:, :, :3].astype(np.int16)
    red = source_rgb[:, :, 0]
    green = source_rgb[:, :, 1]
    blue = source_rgb[:, :, 2]
    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    difference = np.mean(np.abs(source_rgb - clean_rgb), axis=2)
    source_mask_name = {
        "grass": "grass_center.png",
        "vine": "vines_all.png",
        "canopy": "tree_canopy_center.png",
    }[region.kind]
    source_layer_alpha = np.asarray(
        open_rgba(DYNAMIC_ROOT / source_mask_name).crop(box).getchannel("A"),
        dtype=np.uint8,
    )

    green_material = (
        (hue >= 22)
        & (hue <= 112)
        & (saturation >= (28 if region.kind == "vine" else 34))
        & (value >= 26)
        & (green >= red * 0.66)
        & (green >= blue * 0.72)
    )
    changed_from_clean_plate = difference >= (8 if region.kind == "canopy" else 10)
    mask = np.where(green_material & changed_from_clean_plate & (source_layer_alpha > 16), source_layer_alpha, 0).astype(np.uint8)
    if region.kind == "grass":
        mask[:10, :] = 0

    # Preserve the authored antialiasing at plant edges while dropping isolated
    # sky/stone noise. The mask geometry is reused for all four time phases.
    alpha = Image.fromarray(mask, mode="L").filter(ImageFilter.MedianFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.55))
    return alpha


def crop_with_alpha(reference: Image.Image, region: PrototypeRegion, alpha: Image.Image) -> Image.Image:
    box = (region.x, region.y, region.x + region.width, region.y + region.height)
    crop = reference.crop(box).convert("RGBA")
    crop.putalpha(alpha)
    return crop


def diagnostic_vertical_components(reference: Image.Image, static: Image.Image) -> list[dict[str, int]]:
    source = np.asarray(reference.convert("RGB"), dtype=np.int16)
    clean = np.asarray(static.convert("RGB"), dtype=np.int16)
    hsv = np.asarray(reference.convert("HSV"), dtype=np.uint8)
    red, green, blue = source[:, :, 0], source[:, :, 1], source[:, :, 2]
    active = (
        (np.mean(np.abs(source - clean), axis=2) >= 14)
        & (hsv[:, :, 0] >= 22)
        & (hsv[:, :, 0] <= 112)
        & (hsv[:, :, 1] >= 34)
        & (green >= red * 0.66)
        & (green >= blue * 0.72)
    )
    visited = np.zeros(active.shape, dtype=bool)
    components: list[dict[str, int]] = []
    height, width = active.shape
    for y in range(height):
        for x in range(width):
            if not active[y, x] or visited[y, x]:
                continue
            stack = [(x, y)]
            visited[y, x] = True
            min_x = max_x = x
            min_y = max_y = y
            count = 0
            while stack:
                cx, cy = stack.pop()
                count += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < width and 0 <= ny < height and active[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((nx, ny))
            component_width = max_x - min_x + 1
            component_height = max_y - min_y + 1
            if count >= 35 and component_height >= 24:
                components.append({
                    "x": min_x,
                    "y": min_y,
                    "width": component_width,
                    "height": component_height,
                    "pixels": count,
                })
    return sorted(components, key=lambda item: (item["height"] / max(1, item["width"]), item["pixels"]), reverse=True)[:20]


def remove_prototypes_from_layer(
    layer: Image.Image,
    layer_bounds: dict[str, int],
    global_masks: list[tuple[PrototypeRegion, Image.Image]],
) -> Image.Image:
    output = layer.copy()
    alpha = output.getchannel("A")
    layer_x = int(layer_bounds["x"])
    layer_y = int(layer_bounds["y"])
    layer_right = layer_x + int(layer_bounds["width"])
    layer_bottom = layer_y + int(layer_bounds["height"])
    for region, mask in global_masks:
        left = max(layer_x, region.x)
        top = max(layer_y, region.y)
        right = min(layer_right, region.x + region.width)
        bottom = min(layer_bottom, region.y + region.height)
        if left >= right or top >= bottom:
            continue
        local_box = (left - layer_x, top - layer_y, right - layer_x, bottom - layer_y)
        mask_box = (left - region.x, top - region.y, right - region.x, bottom - region.y)
        existing = alpha.crop(local_box)
        cut = mask.crop(mask_box)
        remaining = ImageChops.subtract(existing, cut, scale=1, offset=0)
        alpha.paste(remaining, local_box)
    output.putalpha(alpha)
    return output


def build_preview(
    reference: Image.Image,
    static: Image.Image,
    masks: dict[str, Image.Image],
) -> None:
    cell_width = 360
    cell_height = 250
    label_height = 32
    sheet = Image.new("RGB", (cell_width * 3, (cell_height + label_height) * len(REGIONS)), (9, 14, 17))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for row, region in enumerate(REGIONS):
        box = (region.x, region.y, region.x + region.width, region.y + region.height)
        source_crop = reference.crop(box).convert("RGBA")
        static_crop = static.crop(box).convert("RGBA")
        isolated = crop_with_alpha(reference, region, masks[region.id])
        black = Image.new("RGBA", isolated.size, (8, 12, 14, 255))
        black.alpha_composite(isolated)
        y = row * (cell_height + label_height)
        for column, (label, image) in enumerate((
            (f"{region.id}: source", source_crop),
            (f"{region.id}: clean plate", static_crop),
            (f"{region.id}: isolated motion layer", black),
        )):
            fitted = image.convert("RGB").resize((cell_width, cell_height), Image.Resampling.NEAREST)
            x = column * cell_width
            sheet.paste(fitted, (x, y))
            draw.text((x + 9, y + cell_height + 9), label, fill=(218, 222, 213), font=font)
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_ROOT / "wind-prototype-layer-audit.png", quality=94)


def main() -> None:
    manifest_v4 = json.loads((V4_ROOT / "manifest.json").read_text(encoding="utf-8"))
    reference_noon = open_rgba(REFERENCE_ROOT / "static_noon.png")
    static_noon = open_rgba(STATIC_ROOT / "noon.png")
    masks = {region.id: vegetation_mask(reference_noon, static_noon, region) for region in REGIONS}
    global_masks = [(region, masks[region.id]) for region in REGIONS]

    for phase in PHASES:
        reference = open_rgba(REFERENCE_ROOT / f"static_{phase}.png")
        for region in REGIONS:
            path = OUTPUT_ROOT / phase / "prototype" / f"{region.id}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            crop_with_alpha(reference, region, masks[region.id]).save(path, optimize=True)

        for asset_id, raw_bounds in manifest_v4["assets"].items():
            source_path = V4_ROOT / phase / "vegetation" / f"{asset_id}.png"
            layer = Image.open(source_path).convert("RGBA")
            output = remove_prototypes_from_layer(layer, raw_bounds, global_masks)
            path = OUTPUT_ROOT / phase / "vegetation" / f"{asset_id}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            output.save(path, optimize=True)

    manifest = {
        "version": 1,
        "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
        "phases": list(PHASES),
        "strategy": "Three local Mesh2D wind studies with matching cut-outs in the static vegetation layers.",
        "prototypeRegions": {
            region.id: {
                "kind": region.kind,
                "x": region.x,
                "y": region.y,
                "width": region.width,
                "height": region.height,
                "columns": region.columns,
                "rows": region.rows,
                "phaseOffset": region.phase_offset,
                "tipDisplacement": region.tip_displacement,
            }
            for region in REGIONS
        },
        "vegetationAssets": manifest_v4["assets"],
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    build_preview(reference_noon, static_noon, masks)
    manifest["diagnosticVerticalCandidates"] = diagnostic_vertical_components(reference_noon, static_noon)
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
