from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\User\Downloads\map\DYNAMIC_VEGETATION\TIME_GRADED\noon")
STATIC = Path(r"C:\Users\User\Downloads\map\STATIC\static_noon.png")
OUTPUT = ROOT / "previews" / "vegetation-layer-diagnostic"
LAYERS = ("grass_left", "grass_center", "grass_right", "vines_all")


def checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, "#172026")
    draw = ImageDraw.Draw(image)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#26333a")
    return image.convert("RGBA")


def alpha_preview(layer: Image.Image) -> Image.Image:
    alpha = layer.getchannel("A")
    tinted = Image.new("RGBA", layer.size, (255, 90, 40, 0))
    tinted.putalpha(alpha.point(lambda value: min(220, int(value * 0.86))))
    background = checkerboard(layer.size)
    background.alpha_composite(tinted)
    return background


def label(image: Image.Image, title: str) -> Image.Image:
    banner = Image.new("RGBA", (image.width, 58), "#091116")
    draw = ImageDraw.Draw(banner)
    draw.text((18, 15), title, fill="#f3e4c0", font=ImageFont.load_default(size=24))
    result = Image.new("RGBA", (image.width, image.height + banner.height), "#091116")
    result.alpha_composite(banner)
    result.alpha_composite(image, (0, banner.height))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    static = Image.open(STATIC).convert("RGBA")
    cards: list[Image.Image] = []
    for name in LAYERS:
        layer = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        alpha = layer.getchannel("A")
        bbox = alpha.getbbox()
        if bbox is None:
            raise RuntimeError(f"{name} has no visible pixels")

        overlay = static.copy()
        tint = Image.new("RGBA", layer.size, (255, 72, 32, 0))
        tint.putalpha(alpha.point(lambda value: min(205, int(value * 0.8))))
        overlay.alpha_composite(tint)
        overlay = label(overlay, f"{name} — red = every moving pixel")
        overlay.save(OUTPUT / f"{name}-over-static.png")

        isolated = label(alpha_preview(layer), f"{name} alpha footprint; bbox={bbox}")
        isolated.save(OUTPUT / f"{name}-alpha.png")
        cards.append(overlay.resize((836, 499), Image.Resampling.LANCZOS))

    sheet = Image.new("RGBA", (1672, 998), "#091116")
    for index, card in enumerate(cards):
        sheet.alpha_composite(card, ((index % 2) * 836, (index // 2) * 499))
    sheet.save(OUTPUT / "all-moving-layers-over-static.png")

    combined = Image.new("RGBA", static.size, (0, 0, 0, 0))
    for name in ("grass_left", "grass_center", "grass_right"):
        combined.alpha_composite(Image.open(SOURCE / f"{name}.png").convert("RGBA"))
    hsv = combined.convert("HSV")
    hue, saturation, _value = hsv.split()
    source_alpha = combined.getchannel("A")
    candidates: list[Image.Image] = []
    for hue_floor, saturation_floor in ((28, 48), (32, 42), (36, 34), (40, 26)):
        hue_mask = hue.point(lambda value, floor=hue_floor: 255 if floor <= value <= 105 else 0)
        saturation_mask = saturation.point(lambda value, floor=saturation_floor: 255 if value >= floor else 0)
        mask = ImageChops.multiply(ImageChops.multiply(hue_mask, saturation_mask), source_alpha)
        tint = Image.new("RGBA", static.size, (255, 64, 24, 0))
        tint.putalpha(mask.point(lambda value: min(215, value)))
        candidate = static.copy()
        candidate.alpha_composite(tint)
        candidates.append(label(candidate, f"green mask H>={hue_floor}, S>={saturation_floor}").resize((836, 499), Image.Resampling.LANCZOS))
    candidate_sheet = Image.new("RGBA", (1672, 998), "#091116")
    for index, card in enumerate(candidates):
        candidate_sheet.alpha_composite(card, ((index % 2) * 836, (index // 2) * 499))
    candidate_sheet.save(OUTPUT / "grass-green-mask-candidates.png")

    rgba = np.asarray(combined, dtype=np.uint8)
    red = rgba[:, :, 0].astype(np.int16)
    green = rgba[:, :, 1].astype(np.int16)
    blue = rgba[:, :, 2].astype(np.int16)
    alpha_array = rgba[:, :, 3]
    rgb_conditions = (
        ("G-R>5, G-B>15", (green - red > 5) & (green - blue > 15)),
        ("G-R>10, G-B>20", (green - red > 10) & (green - blue > 20)),
        ("G-R>2, G-B>28", (green - red > 2) & (green - blue > 28)),
        ("G>R*1.05, G>B*1.15", (green * 100 > red * 105) & (green * 100 > blue * 115)),
    )
    rgb_candidates: list[Image.Image] = []
    for title, condition in rgb_conditions:
        mask_array = np.where(condition, alpha_array, 0).astype(np.uint8)
        mask = Image.fromarray(mask_array, mode="L")
        tint = Image.new("RGBA", static.size, (255, 64, 24, 0))
        tint.putalpha(mask.point(lambda value: min(215, value)))
        candidate = static.copy()
        candidate.alpha_composite(tint)
        rgb_candidates.append(label(candidate, title).resize((836, 499), Image.Resampling.LANCZOS))
    rgb_sheet = Image.new("RGBA", (1672, 998), "#091116")
    for index, card in enumerate(rgb_candidates):
        rgb_sheet.alpha_composite(card, ((index % 2) * 836, (index // 2) * 499))
    rgb_sheet.save(OUTPUT / "grass-rgb-mask-candidates.png")


if __name__ == "__main__":
    main()
