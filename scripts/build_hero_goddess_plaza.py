import bpy, bmesh
import os, math, random

WORK_DIR = r'F:\hunyuan3d_workspace\hero_showcase'
TEX_DIR = os.path.join(WORK_DIR, 'textures')
OUT_DIR = r'F:\三亚千古情3D导览图\models'
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)


def make_mat(name, base_col, rough=0.72, metal=0.0, emit_col=None, emit_str=0.0, img_path=None, uv_scale=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base_col, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit_col and 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = (*emit_col, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_str
    if img_path and os.path.exists(img_path):
        tex_node = nt.nodes.new('ShaderNodeTexImage')
        tex_node.image = bpy.data.images.load(img_path)
        if uv_scale != 1.0:
            coord = nt.nodes.new('ShaderNodeTexCoord')
            mapping = nt.nodes.new('ShaderNodeMapping')
            mapping.inputs['Scale'].default_value = (uv_scale, uv_scale, 1.0)
            nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
            nt.links.new(mapping.outputs['Vector'], tex_node.inputs['Vector'])
        nt.links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def add_beveled_box(name, size_xyz, loc_xyz, mat, bevel_w=0.08, rot_euler=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc_xyz, rotation=rot_euler)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size_xyz
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = obj.modifiers.new('Bevel', 'BEVEL')
    bev.width = bevel_w
    bev.segments = 2
    bpy.ops.object.modifier_apply(modifier=bev.name)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.uv.cube_project(cube_size=8.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.materials.append(mat)
    return obj


def build_realistic_coconut_palm(cx, cy, height, lean_x, lean_y, seed, mats):
    rng = random.Random(seed)
    bm = bmesh.new()
    segs = 14
    rings = []
    for i in range(segs + 1):
        t = i / segs
        z = t * height
        ox = lean_x * (t ** 1.7)
        oy = lean_y * (t ** 1.7)
        r = (0.36 * (1 - 0.52 * t)) * (1.06 if i % 2 == 0 else 0.96)
        ring = []
        for k in range(10):
            ang = k * math.pi * 2 / 10
            ring.append(bm.verts.new((cx + ox + math.cos(ang) * r, cy + oy + math.sin(ang) * r, z)))
        rings.append(ring)
    for i in range(segs):
        for k in range(10):
            k2 = (k + 1) % 10
            bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    mesh = bpy.data.meshes.new(f'PalmTrunk_{seed}')
    bm.to_mesh(mesh)
    bm.free()
    trunk_obj = bpy.data.objects.new(f'PalmTrunk_{seed}', mesh)
    trunk_obj.data.materials.append(mats['bark'])
    bpy.context.scene.collection.objects.link(trunk_obj)

    top_x = cx + lean_x
    top_y = cy + lean_y
    top_z = height - 0.15

    # Coconuts cluster
    for c_idx in range(4):
        ca = c_idx * 1.57 + 0.4
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.22,
            location=(top_x + math.cos(ca) * 0.28, top_y + math.sin(ca) * 0.28, top_z - 0.22))
        coco = bpy.context.active_object
        coco.data.materials.append(mats['coconut'])

    # 13 arched multi-segment pinnate fronds
    bm_f = bmesh.new()
    for f_idx in range(13):
        az = (f_idx * math.pi * 2 / 13) + rng.uniform(-0.12, 0.12)
        pitch0 = rng.uniform(-0.25, 0.42)
        flen = rng.uniform(3.4, 4.6)
        prev_l = prev_r = prev_c = None
        for s in range(7):
            u = s / 6.0
            dist = u * flen
            dz = math.sin(pitch0) * dist - (1.55 * (u ** 2.1)) * (flen * 0.36)
            w = 0.62 * math.sin(math.pi * min(0.95, u * 0.92 + 0.08))
            px = top_x + math.cos(az) * dist
            py = top_y + math.sin(az) * dist
            pz = top_z + dz
            nx, ny = -math.sin(az) * w, math.cos(az) * w
            vc = bm_f.verts.new((px, py, pz + 0.08))
            vl = bm_f.verts.new((px + nx, py + ny, pz - 0.12))
            vr = bm_f.verts.new((px - nx, py - ny, pz - 0.12))
            if prev_c is not None:
                bm_f.faces.new((prev_l, prev_c, vc, vl))
                bm_f.faces.new((prev_c, prev_r, vr, vc))
            prev_l, prev_r, prev_c = vl, vr, vc
    f_mesh = bpy.data.meshes.new(f'PalmFronds_{seed}')
    bm_f.to_mesh(f_mesh)
    bm_f.free()
    f_obj = bpy.data.objects.new(f'PalmFronds_{seed}', f_mesh)
    f_obj.data.materials.append(mats['palm_leaf'])
    bpy.context.scene.collection.objects.link(f_obj)


def make_organic_foliage_cluster(cx, cy, cz, rad, seed, mat, scale_xyz=(1.2, 1.0, 0.72)):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=rad, location=(cx, cy, cz))
    obj = bpy.context.active_object
    for v in obj.data.vertices:
        n = 1.0 + 0.16 * math.sin(v.co.x * 3.1 + seed) * math.cos(v.co.y * 2.9 - seed) + rng.uniform(-0.07, 0.07)
        v.co.x *= n * scale_xyz[0]
        v.co.y *= n * scale_xyz[1]
        v.co.z *= n * scale_xyz[2]
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def add_flowerbed_with_bougainvillea(cx, cy, wx, wy, seed, mats):
    rng = random.Random(seed)
    add_beveled_box(f'PlanterCurb_{seed}', (wx, wy, 0.85), (cx, cy, 0.425), mats['granite'], 0.06)
    add_beveled_box(f'PlanterSoil_{seed}', (wx - 0.5, wy - 0.5, 0.72), (cx, cy, 0.4), mats['soil'], 0.02)
    count = max(10, int((wx * wy) / 2.2))
    for i in range(count):
        px = cx + rng.uniform(-wx * 0.38, wx * 0.38)
        py = cy + rng.uniform(-wy * 0.38, wy * 0.38)
        r = rng.uniform(0.55, 1.15)
        make_organic_foliage_cluster(
            px, py, 0.85 + r * 0.45, r, seed * 31 + i,
            mats['bush_green'] if i % 3 != 0 else mats['bougainvillea'],
            (1.15, 1.15, 0.68),
        )


def build_banyan_collar_tree(cx, cy, z0, side_sign, mats):
    for b_idx in range(4):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.42 - b_idx * 0.06, depth=5.8,
            location=(cx + b_idx * 0.38 * side_sign, cy + (b_idx % 2) * 0.35, z0 + 2.4),
            rotation=(0.12, -0.24 * side_sign, b_idx * 0.3))
        tr = bpy.context.active_object
        bpy.ops.object.shade_smooth()
        tr.data.materials.append(mats['bark'])
    for c_idx, (ox, oy, oz, rad) in enumerate([
        (0.0, 0.0, 5.1, 2.0), (1.7 * side_sign, -0.5, 5.8, 1.8),
        (-1.1 * side_sign, 0.6, 4.6, 1.65), (0.9 * side_sign, 0.4, 6.4, 1.45),
        (2.4 * side_sign, 0.2, 4.9, 1.5),
    ]):
        make_organic_foliage_cluster(
            cx + ox, cy + oy, z0 + oz, rad, 700 + c_idx * 17 + (10 if side_sign > 0 else 0),
            mats['banyan_leaf'] if c_idx != 3 else mats['bougainvillea'],
            (1.22, 1.05, 0.62),
        )


def build_hard_surface_gatehouse_and_plaza(mats):
    # 1. 火山岩图腾大道与迎宾大广场地面 (Blender X=左右宽, -Y=前方迎宾大道方向, +Y=后方大厅方向, +Z=高度)
    add_beveled_box('PlazaBase', (96.0, 92.0, 0.3), (0, 6.0, 0.15), mats['lawn'], 0.02)
    add_beveled_box('VolcanicBoulevard', (24.0, 44.0, 0.42), (0, -24.0, 0.21), mats['basalt_road'], 0.04)
    add_beveled_box('BoulevardCarpet', (10.5, 42.0, 0.46), (0, -24.0, 0.23), mats['granite_light'], 0.03)
    add_beveled_box('ForecourtApron', (78.0, 18.0, 0.44), (0, -4.5, 0.22), mats['granite_light'], 0.04)

    # 门洞前五级迎宾花岗岩石阶
    for s in range(5):
        add_beveled_box(f'GateStep_{s}', (21.0 - s * 0.4, 4.8 - s * 0.7, 0.28), (0, -3.2 + s * 0.42, 0.36 + s * 0.24), mats['granite'], 0.03)

    # 2. 后方互动游乐馆主立面体块（硬朗折线女儿墙、壁柱与挑檐线脚）
    add_beveled_box('MainHallBody', (76.0, 34.0, 19.5), (0, 23.0, 9.75), mats['rose_stone'], 0.12)
    add_beveled_box('MainHallPlinth', (77.4, 35.4, 2.2), (0, 23.0, 1.1), mats['terracotta_dark'], 0.08)
    add_beveled_box('MainHallCornice', (77.6, 35.6, 1.1), (0, 23.0, 19.6), mats['cream_cornice'], 0.08)
    add_beveled_box('MainHallRoofDeck', (73.6, 31.6, 0.6), (0, 23.0, 19.8), mats['cream_roof'], 0.04)

    # 东南/西南外墙古典壁柱分缝
    for px in range(-34, 35, 8):
        add_beveled_box(f'HallPilaster_{px}', (1.1, 0.6, 17.2), (px, 5.8, 9.8), mats['terracotta_dark'], 0.05)

    # 3. 阶梯式门头检票大厅与左右翼亭
    for side in (-1, 1):
        # 上层白象承托挑台
        add_beveled_box(f'UpperEleDeck_{side}', (24.0, 12.0, 13.5), (side * 24.5, 5.0, 6.75), mats['rose_stone'], 0.1)
        add_beveled_box(f'UpperEleCornice_{side}', (24.8, 12.8, 0.9), (side * 24.5, 5.0, 13.6), mats['cream_cornice'], 0.06)
        # 中层退台小象承托廊与售票窗口
        add_beveled_box(f'LowerEleWing_{side}', (15.5, 9.0, 8.2), (side * 17.5, -1.5, 4.1), mats['terracotta'], 0.08)
        add_beveled_box(f'LowerWingCornice_{side}', (16.2, 9.6, 0.75), (side * 17.5, -1.5, 8.3), mats['cream_cornice'], 0.05)
        # 外翼游客服务/医务/寄存侧厅（带内凹深色门窗与屋顶露台围栏）
        add_beveled_box(f'OuterPavilion_{side}', (12.0, 10.5, 6.4), (side * 30.5, -2.2, 3.2), mats['rose_stone'], 0.08)
        add_beveled_box(f'OuterPavDoor_{side}', (4.6, 1.2, 3.8), (side * 30.5, -7.1, 2.1), mats['dark_void'], 0.02)
        add_beveled_box(f'OuterPavCoping_{side}', (12.8, 11.2, 0.65), (side * 30.5, -2.2, 6.55), mats['cream_cornice'], 0.05)
        # 外挂拾级石阶梯
        for st in range(10):
            add_beveled_box(f'SideStair_{side}_{st}', (2.6, 0.65, 0.55), (side * 11.2, -3.5 + st * 0.55, 4.2 + st * 0.45), mats['granite'], 0.02)

    # 4. 中央内凹检票门洞、M形青绿黎锦浮雕门楣与女神莲座高台
    add_beveled_box('PortalLeftPillar', (4.2, 8.5, 11.2), (-8.4, -2.2, 5.6), mats['terracotta'], 0.08)
    add_beveled_box('PortalRightPillar', (4.2, 8.5, 11.2), (8.4, -2.2, 5.6), mats['terracotta'], 0.08)
    add_beveled_box('PortalLintel', (21.2, 8.5, 3.2), (0, -2.2, 10.4), mats['terracotta'], 0.08)
    add_beveled_box('PortalTunnelVoid', (12.6, 9.5, 8.2), (0, -0.5, 4.5), mats['dark_void'], 0.02)

    # 门洞内5组不锈钢检票闸机 + 暖光迎宾吊顶灯带
    for tx in (-4.4, -2.2, 0.0, 2.2, 4.4):
        add_beveled_box(f'Turnstile_{tx}', (0.42, 1.8, 1.1), (tx, -2.6, 1.8), mats['steel'], 0.03)
        add_beveled_box(f'TurnLight_{tx}', (0.22, 0.15, 0.15), (tx, -3.52, 2.15), mats['led_green'], 0.01)
    add_beveled_box('CeilingGlow', (11.5, 6.0, 0.25), (0, -1.8, 8.45), mats['warm_lamp'], 0.02)

    # 标志性山形折线青绿松石黎锦浮雕门楣
    for side in (-1, 1):
        add_beveled_box(f'TurquoiseFriezeOuter_{side}', (5.8, 1.2, 1.65), (side * 5.2, -6.3, 10.6), mats['turquoise_relief'], 0.04, (0, side * 0.26, 0))
        add_beveled_box(f'TurquoiseFriezeInner_{side}', (3.6, 1.25, 1.65), (side * 1.5, -6.4, 11.2), mats['gold_bronze'], 0.04, (0, -side * 0.32, 0))
        add_beveled_box(f'TurquoisePillarRelief_{side}', (2.4, 0.9, 8.2), (side * 8.4, -6.2, 5.2), mats['turquoise_relief'], 0.04)

    # 女神三面巨像承托须弥宝座
    add_beveled_box('GoddessPedestal1', (14.5, 11.5, 3.6), (0, 1.5, 12.6), mats['terracotta_dark'], 0.1)
    add_beveled_box('GoddessPedestal2', (11.6, 9.6, 2.2), (0, 1.5, 15.2), mats['gold_bronze'], 0.08)


def add_visitor_and_parasol_details(mats):
    # 门前两侧休闲遮阳木伞座
    for px, py in [(-21.0, -14.0), (-26.5, -18.5), (21.0, -14.0), (26.5, -18.5)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.09, depth=3.1, location=(px, py, 1.8))
        bpy.context.active_object.data.materials.append(mats['bark'])
        bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=2.3, radius2=0.1, depth=0.95, location=(px, py, 3.35))
        bpy.context.active_object.data.materials.append(mats['cream_roof'])
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.05, depth=0.12, location=(px, py, 1.15))
        bpy.context.active_object.data.materials.append(mats['terracotta'])


def add_totem_pillars_and_eaves(mats):
    # 图腾大道两侧 6 根红金彩绘黎苗图腾神柱（每侧 3 根，带八角柱础与顶部灯冠）
    for side in (-1, 1):
        for idx, py in enumerate([-12.5, -21.5, -30.5]):
            px = side * 9.8
            add_beveled_box(f'TotemBase_{side}_{idx}', (1.7, 1.7, 1.1), (px, py, 0.95), mats['granite'], 0.06)
            bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.58, depth=6.6, location=(px, py, 4.7))
            col = bpy.context.active_object
            col.name = f'TotemShaft_{side}_{idx}'
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.uv.cylinder_project()
            bpy.ops.object.mode_set(mode='OBJECT')
            col.data.materials.append(mats['totem_pillar'])
            add_beveled_box(f'TotemCap_{side}_{idx}', (1.55, 1.55, 0.65), (px, py, 8.2), mats['gold_bronze'], 0.08)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.42, location=(px, py, 8.85))
            orb = bpy.context.active_object
            orb.data.materials.append(mats['warm_lamp'])

    # 翼楼与主楼青灰筒瓦坡檐压顶装饰（呼应原图灰瓦细檐）
    add_beveled_box('MainHallTileTrim', (78.2, 36.2, 0.75), (0, 23.0, 20.1), mats['roof_tile'], 0.04)
    for side in (-1, 1):
        add_beveled_box(f'LowerTileTrim_{side}', (16.6, 10.0, 0.55), (side * 17.5, -1.5, 8.7), mats['roof_tile'], 0.03)
        add_beveled_box(f'OuterTileTrim_{side}', (13.2, 11.6, 0.52), (side * 30.5, -2.2, 6.9), mats['roof_tile'], 0.03)
        # 主楼高位 4 尊巨象外墙衬垫石墩（紧贴主楼外墙 y=5.7，不前凸以免与白象耳穿模）
        for j in range(4):
            ex = side * (14.5 + j * 6.0)
            add_beveled_box(f'UpperEleMount_{side}_{j}', (4.4, 0.8, 5.2), (ex, 5.75, 16.4), mats['terracotta_dark'], 0.06)


def main():
    tx = lambda fn: os.path.join(TEX_DIR, fn)
    mats = {
        'lawn': make_mat('Lawn', (0.44, 0.58, 0.35), 0.92),
        'basalt_road': make_mat('BasaltRoad', (0.28, 0.29, 0.31), 0.86, 0.0, None, 0.0, tx('basalt_road.jpg'), 2.2),
        'granite_light': make_mat('GraniteLight', (0.72, 0.71, 0.69), 0.78, 0.0, None, 0.0, tx('plaza_granite.jpg'), 2.5),
        'granite': make_mat('Granite', (0.58, 0.58, 0.59), 0.80, 0.0, None, 0.0, tx('plaza_granite.jpg'), 1.8),
        'rose_stone': make_mat('RoseStone', (0.80, 0.60, 0.56), 0.74, 0.0, None, 0.0, tx('rose_stone_wall.jpg'), 1.6),
        'terracotta': make_mat('Terracotta', (0.70, 0.45, 0.39), 0.72, 0.0, None, 0.0, tx('terracotta_carved.jpg'), 1.5),
        'terracotta_dark': make_mat('TerracottaDark', (0.54, 0.33, 0.28), 0.76, 0.0, None, 0.0, tx('terracotta_carved.jpg'), 1.8),
        'cream_cornice': make_mat('CreamCornice', (0.89, 0.84, 0.77), 0.68),
        'cream_roof': make_mat('CreamRoof', (0.85, 0.80, 0.73), 0.78),
        'turquoise_relief': make_mat('TurquoiseRelief', (0.20, 0.54, 0.48), 0.46, 0.22, None, 0.0, tx('turquoise_lijin.jpg'), 1.2),
        'totem_pillar': make_mat('TotemPillar', (0.76, 0.22, 0.16), 0.52, 0.12, None, 0.0, tx('totem_pillar.jpg'), 1.0),
        'roof_tile': make_mat('RoofTile', (0.44, 0.46, 0.50), 0.72, 0.05, None, 0.0, tx('roof_tile.jpg'), 2.0),
        'gold_bronze': make_mat('GoldBronze', (0.76, 0.55, 0.26), 0.36, 0.55),
        'dark_void': make_mat('DarkVoid', (0.09, 0.06, 0.06), 0.95),
        'steel': make_mat('Steel', (0.72, 0.75, 0.78), 0.28, 0.82),
        'led_green': make_mat('LedGreen', (0.15, 0.95, 0.45), 0.2, 0.0, (0.15, 0.95, 0.45), 3.5),
        'warm_lamp': make_mat('WarmLamp', (1.0, 0.88, 0.62), 0.3, 0.0, (1.0, 0.85, 0.52), 2.8),
        'bark': make_mat('Bark', (0.36, 0.26, 0.18), 0.9),
        'coconut': make_mat('Coconut', (0.28, 0.18, 0.09), 0.8),
        'palm_leaf': make_mat('PalmLeaf', (0.22, 0.48, 0.18), 0.62),
        'banyan_leaf': make_mat('BanyanLeaf', (0.19, 0.42, 0.17), 0.72),
        'bush_green': make_mat('BushGreen', (0.25, 0.50, 0.20), 0.78),
        'bougainvillea': make_mat('Bougainvillea', (0.84, 0.14, 0.38), 0.68),
        'soil': make_mat('Soil', (0.25, 0.18, 0.14), 0.95),
    }

    build_hard_surface_gatehouse_and_plaza(mats)
    add_totem_pillars_and_eaves(mats)

    # 女神肩颈两侧标志性“树衣领”苍劲古榕树
    build_banyan_collar_tree(-8.2, 1.8, 12.2, -1, mats)
    build_banyan_collar_tree(8.2, 1.8, 12.2, 1, mats)

    # 门前与两侧怒放三角梅热带花池
    for idx, (fx, fy, fw, fd) in enumerate([
        (-16.5, -9.2, 9.5, 4.2), (16.5, -9.2, 9.5, 4.2),
        (-31.5, -9.8, 11.0, 4.5), (31.5, -9.8, 11.0, 4.5),
        (-15.5, -24.0, 5.2, 28.0), (15.5, -24.0, 5.2, 28.0),
    ]):
        add_flowerbed_with_bougainvillea(fx, fy, fw, fd, 100 + idx, mats)

    # 16棵真实弯曲树干+羽状垂叶椰子树林
    palms = [
        (-15.5, -13.0, 10.5, -1.1, -0.6), (15.5, -13.0, 10.8, 1.2, -0.5),
        (-16.2, -22.0, 9.6, -0.9, 0.4), (16.2, -22.0, 9.8, 0.8, 0.5),
        (-15.2, -31.0, 11.2, -1.3, -0.4), (15.2, -31.0, 11.0, 1.1, -0.5),
        (-28.0, -10.5, 11.5, -1.4, -0.8), (28.0, -10.5, 11.8, 1.5, -0.7),
        (-37.5, -6.0, 10.2, -1.2, 0.5), (37.5, -6.0, 10.4, 1.2, 0.4),
        (-41.0, 8.0, 12.0, -1.5, 0.3), (41.0, 8.0, 12.2, 1.4, 0.3),
    ]
    for i, (px, py, ph, lx, ly) in enumerate(palms):
        build_realistic_coconut_palm(px, py, ph, lx, ly, 300 + i, mats)

    add_visitor_and_parasol_details(mats)

    out_glb = os.path.join(OUT_DIR, 'hero_goddess_arch_base.glb')
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        export_yup=True,
        export_image_format='JPEG',
        export_jpeg_quality=86,
    )
    print('SAVED HERO ARCH BASE:', out_glb, os.path.getsize(out_glb))


if __name__ == '__main__':
    main()
