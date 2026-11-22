import bpy, os, mathutils

RAW_DIR = r'F:\hunyuan3d_workspace\hero_showcase'
OUT_DIR = r'F:\三亚千古情3D导览图\models'
os.makedirs(OUT_DIR, exist_ok=True)

ITEMS = [
    ('hero_goddess_bust_raw.glb', 'hero_goddess_bust.glb', 32000, 1024),
    ('hero_white_elephant_raw.glb', 'hero_white_elephant.glb', 22000, 1024),
]

for src_name, dst_name, target_faces, tex_size in ITEMS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    src_path = os.path.join(RAW_DIR, src_name)
    bpy.ops.import_scene.gltf(filepath=src_path)

    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    pts = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    xs = [v.x for v in pts]
    ys = [v.y for v in pts]
    zs = [v.z for v in pts]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))
    min_z = min(zs)
    h = max(zs) - min_z

    obj.location = (-cx, -cy, -min_z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    if h > 1e-4:
        s = 1.0 / h
        obj.scale = (s, s, s)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    cur_faces = len(obj.data.polygons)
    if cur_faces > target_faces:
        dec = obj.modifiers.new('Decimate', 'DECIMATE')
        dec.ratio = target_faces / float(cur_faces)
        bpy.ops.object.modifier_apply(modifier=dec.name)

    bpy.ops.object.shade_smooth()

    for mat in obj.data.materials:
        if mat and mat.use_nodes:
            bsdf = mat.node_tree.nodes.get('Principled BSDF')
            if bsdf:
                bsdf.inputs['Roughness'].default_value = 0.78
                bsdf.inputs['Metallic'].default_value = 0.04

    for img in bpy.data.images:
        if img.size[0] > tex_size or img.size[1] > tex_size:
            img.scale(tex_size, tex_size)

    out_path = os.path.join(OUT_DIR, dst_name)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_image_format='JPEG',
        export_jpeg_quality=88,
    )
    pts2 = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    xs2 = [v.x for v in pts2]; ys2 = [v.y for v in pts2]; zs2 = [v.z for v in pts2]
    print(f'EXPORTED {dst_name}: faces={len(obj.data.polygons)}, size={os.path.getsize(out_path)/1024/1024:.2f}MB, '
          f'bounds X=[{min(xs2):.2f},{max(xs2):.2f}] Y=[{min(ys2):.2f},{max(ys2):.2f}] Z=[{min(zs2):.2f},{max(zs2):.2f}]')
