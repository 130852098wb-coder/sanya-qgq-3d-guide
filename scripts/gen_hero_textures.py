import os, random, math
from PIL import Image, ImageDraw, ImageFilter

TEX_DIR = r'F:\hunyuan3d_workspace\hero_showcase\textures'
os.makedirs(TEX_DIR, exist_ok=True)


def add_grain(img, strength=10, seed=1):
    rng = random.Random(seed)
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = rng.randint(-strength, strength)
            px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return img


def make_plaza_granite():
    sz = 512
    img = Image.new('RGB', (sz, sz), (176, 174, 170))
    draw = ImageDraw.Draw(img)
    step = 64
    rng = random.Random(11)
    for gy in range(0, sz, step):
        for gx in range(0, sz, step):
            v = rng.randint(-12, 12)
            col = (176 + v, 174 + v, 170 + v)
            draw.rectangle([gx + 2, gy + 2, gx + step - 2, gy + step - 2], fill=col)
            draw.rectangle([gx, gy, gx + step - 1, gy + step - 1], outline=(126, 124, 122), width=2)
    add_grain(img, 8, 12)
    img.save(os.path.join(TEX_DIR, 'plaza_granite.jpg'), 'JPEG', quality=88)


def make_basalt_road():
    sz = 512
    img = Image.new('RGB', (sz, sz), (78, 80, 86))
    draw = ImageDraw.Draw(img)
    rng = random.Random(21)
    row_h = 32
    for row in range(sz // row_h):
        y = row * row_h
        offset = (row % 2) * 32
        for gx in range(-32, sz + 32, 64):
            v = rng.randint(-10, 12)
            col = (74 + v, 76 + v, 82 + v)
            draw.rectangle([gx + offset + 2, y + 2, gx + offset + 62, y + row_h - 2], fill=col)
            draw.rectangle([gx + offset, y, gx + offset + 64, y + row_h], outline=(48, 50, 54), width=2)
    add_grain(img, 9, 22)
    img.save(os.path.join(TEX_DIR, 'basalt_road.jpg'), 'JPEG', quality=88)


def make_rose_stone_wall():
    sz = 512
    img = Image.new('RGB', (sz, sz), (206, 162, 154))
    draw = ImageDraw.Draw(img)
    rng = random.Random(31)
    row_h = 64
    for row in range(sz // row_h):
        y = row * row_h
        offset = (row % 2) * 64
        for gx in range(-64, sz + 64, 128):
            v = rng.randint(-8, 8)
            col = (206 + v, 160 + v, 152 + v)
            draw.rectangle([gx + offset + 2, y + 2, gx + offset + 126, y + row_h - 2], fill=col)
            draw.line([gx + offset, y, gx + offset + 128, y], fill=(166, 122, 114), width=2)
            draw.line([gx + offset, y, gx + offset, y + row_h], fill=(166, 122, 114), width=2)
    add_grain(img, 7, 32)
    img.save(os.path.join(TEX_DIR, 'rose_stone_wall.jpg'), 'JPEG', quality=88)


def make_terracotta_carved():
    sz = 512
    img = Image.new('RGB', (sz, sz), (178, 116, 100))
    draw = ImageDraw.Draw(img)
    rng = random.Random(41)
    row_h = 48
    for row in range(sz // row_h):
        y = row * row_h
        offset = (row % 2) * 48
        for gx in range(-48, sz + 48, 96):
            v = rng.randint(-9, 9)
            col = (178 + v, 116 + v, 100 + v)
            draw.rectangle([gx + offset + 2, y + 2, gx + offset + 94, y + row_h - 2], fill=col)
            draw.rectangle([gx + offset, y, gx + offset + 96, y + row_h], outline=(132, 80, 68), width=2)
    add_grain(img, 8, 42)
    img.save(os.path.join(TEX_DIR, 'terracotta_carved.jpg'), 'JPEG', quality=88)


def make_turquoise_lijin():
    # 青绿松石底色 + 金色/暗青几何黎锦菱形浮雕纹
    sz = 512
    img = Image.new('RGB', (sz, sz), (46, 134, 122))
    draw = ImageDraw.Draw(img)
    step = 64
    for gy in range(0, sz, step):
        for gx in range(0, sz, step):
            cx, cy = gx + step // 2, gy + step // 2
            draw.polygon([(cx, gy + 4), (gx + step - 4, cy), (cx, gy + step - 4), (gx + 4, cy)],
                         fill=(34, 104, 96), outline=(198, 160, 88), width=3)
            draw.polygon([(cx, gy + 16), (gx + step - 16, cy), (cx, gy + step - 16), (gx + 16, cy)],
                         fill=(62, 162, 146), outline=(230, 198, 120), width=2)
            draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(224, 184, 96))
    add_grain(img, 6, 52)
    img.save(os.path.join(TEX_DIR, 'turquoise_lijin.jpg'), 'JPEG', quality=90)


def make_totem_pillar():
    # 红金彩绘黎苗图腾神柱纹样
    sz = 512
    img = Image.new('RGB', (sz, sz), (186, 48, 36))
    draw = ImageDraw.Draw(img)
    for y in range(0, sz, 64):
        draw.rectangle([0, y, sz, y + 10], fill=(222, 174, 68))
        draw.rectangle([0, y + 10, sz, y + 16], fill=(42, 124, 114))
        for x in range(0, sz, 64):
            cx, cy = x + 32, y + 40
            draw.polygon([(cx, y + 18), (x + 56, cy), (cx, y + 60), (x + 8, cy)],
                         fill=(142, 32, 24), outline=(235, 192, 86), width=3)
            draw.ellipse([cx - 10, cy - 8, cx + 10, cy + 8], fill=(242, 206, 112), outline=(44, 24, 18), width=2)
    add_grain(img, 6, 62)
    img.save(os.path.join(TEX_DIR, 'totem_pillar.jpg'), 'JPEG', quality=90)


def make_roof_tile():
    sz = 512
    img = Image.new('RGB', (sz, sz), (108, 114, 126))
    draw = ImageDraw.Draw(img)
    for x in range(0, sz, 24):
        draw.rectangle([x, 0, x + 16, sz], fill=(122, 128, 142))
        draw.rectangle([x + 16, 0, x + 24, sz], fill=(76, 82, 94))
    for y in range(0, sz, 32):
        draw.line([0, y, sz, y], fill=(64, 70, 80), width=2)
    add_grain(img, 5, 72)
    img.save(os.path.join(TEX_DIR, 'roof_tile.jpg'), 'JPEG', quality=88)


if __name__ == '__main__':
    make_plaza_granite()
    make_basalt_road()
    make_rose_stone_wall()
    make_terracotta_carved()
    make_turquoise_lijin()
    make_totem_pillar()
    make_roof_tile()
    print('GENERATED 7 HERO PBR TEXTURES IN:', TEX_DIR)
