# assar_cenario.py — cenário pequeno com material procedural (degradê por altura/direção, ruído) → .glb com as cores ASSADAS em imagens
# Uso: blender -b <cenario.blend> --python assar_cenario.py -- <saida.glb> [tamanho=1024]
# Para cada objeto que aparece no render: desdobra a UV (Smart UV Project), assa a EMISSÃO (Cycles) numa imagem só dele e troca o
# material por Emission(imagem). Não salva o .blend. Bom para cenários de até ~100 objetos (quarto, ginásio); a rua usa converter_cenario.py.
import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAIDA = argv[0]; TAM = int(argv[1]) if len(argv) > 1 else 1024
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.device = 'CPU'
try: sc.cycles.use_denoising = False
except Exception: pass
vis = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render and o.visible_get()]
for o in bpy.data.objects: o.select_set(False)
feitos = 0
for o in vis:
    if not o.data.polygons or not o.material_slots: continue
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    # luz de efeito (raio de luar, halo): Mix(Transparente, Emissão) → no Animador a luz SOMA (o preto some, o claro brilha)
    if any(s0.material and s0.material.use_nodes and any(n.type == 'BSDF_TRANSPARENT' for n in s0.material.node_tree.nodes) for s0 in o.material_slots): o['aditivo'] = 1
    if o.data.users > 1: o.data = o.data.copy()  # malha compartilhada: cada um com a sua UV
    uv = o.data.uv_layers.new(name='assado'); o.data.uv_layers.active = uv
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.01); bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'assado_{o.name}', TAM, TAM, alpha=False)
    for s in o.material_slots:
        if not s.material: continue
        s.material = s.material.copy(); nt = s.material.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
    try: bpy.ops.object.bake(type='EMIT', margin=4, use_clear=True)
    except Exception as e: print('NAO ASSOU', o.name, e); o.select_set(False); continue
    for s in o.material_slots:  # material novo: só a imagem assada na emissão, pela UV 'assado'
        if not s.material: continue
        nt = s.material.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'assado'
        nt.links.new(uvn.outputs['UV'], tex.inputs['Vector']); nt.links.new(tex.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
    # a UV assada vira a primeira (o glTF leva a TEXCOORD_0)
    o.data.uv_layers.active = uv
    while o.data.uv_layers[0].name != 'assado':
        o.data.uv_layers.remove(o.data.uv_layers[0])
    o.select_set(False); feitos += 1
for o in bpy.data.objects:
    o.select_set((not o.hide_render) and o.visible_get() and o.type in ('MESH', 'CAMERA', 'LIGHT', 'EMPTY'))
bpy.ops.export_scene.gltf(filepath=SAIDA, export_format='GLB', use_selection=True, export_cameras=True, export_lights=True, export_apply=True, export_extras=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_image_format='WEBP', export_image_quality=88)
print('ASSADO', SAIDA, 'objetos', feitos, 'de', len(vis))
