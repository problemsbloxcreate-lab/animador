# converter_cenario.py — prepara um cenário .blend para o Animador (cenário 3D ao vivo, .glb)  [Estúdio Problems, 13/11/2026]
# Uso: blender -b <cenario.blend> --python converter_cenario.py -- <saida.glb>
# O que faz (sem mexer no .blend original, que não é salvo):
#  1. exporta só o que aparece no render (moldes escondidos ficavam DUPLICADOS no .glb);
#  2. materiais com IMAGEM: a imagem vai como textura (com a cor do LuzCena por cima);
#     materiais PROCEDURAIS (rampa pela direção da superfície = sombra pintada, ruído, tijolo...): o próprio Blender (Cycles) "assa"
#     a cor final de cada vértice num atributo de cor 'cor_assada' (13/11/2026, pedido da dona: árvores chapadas e casa na árvore
#     branca, porque antes ia só a cor média da rampa, ou cinza 0,8 quando a cor vinha por nós de vetor). O material vira Emission
#     branca marcada 'cor_assada' e o Animador pinta com as cores dos vértices (js/cena3d.js);
#  3. comprime (Draco + imagens WebP) e leva as câmeras. O resultado é leve e abre ao vivo no Animador (js/cena3d.js).
import bpy, sys, colorsys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAIDA = argv[0] if argv else bpy.path.abspath('//') + 'cenario.glb'

def rgb(v): return [float(v[0]), float(v[1]), float(v[2])]

def luz_cena(g, cor):
    """Repete o grupo LuzCena (saturação → luz quente → sombra azul nas cores escuras → brilho) lendo os valores do próprio grupo."""
    N = {n.name: n for n in g.nodes}
    def p(nome, entrada, padrao):
        n = N.get(nome)
        try: return n.inputs[entrada].default_value
        except Exception: return padrao
    sat = p('saturacao', 'Saturation', 1.0); hue = p('saturacao', 'Hue', .5); val = p('saturacao', 'Value', 1.0)
    luz = rgb(N['cor_luz'].outputs[0].default_value) if 'cor_luz' in N else [1, 1, 1]
    sombra = rgb(N['sombra'].outputs[0].default_value) if 'sombra' in N else [1, 1, 1]
    forca = p('forca_sombra', 1, .2); brilho = p('brilho', 'Color2', (1, 1, 1, 1))
    h, s, v = colorsys.rgb_to_hsv(*[max(0.0, c) for c in cor]); h = (h + hue - .5) % 1.0; s = min(1.0, s * sat); v = v * val
    c = list(colorsys.hsv_to_rgb(h, s, v)); c = [c[i] * luz[i] for i in range(3)]
    bw = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; f = (1 - bw) * forca
    c = [c[i] * (1 - f) + c[i] * sombra[i] * f for i in range(3)]
    return [c[i] * brilho[i] for i in range(3)]

def cor_de(sock, prof=0):
    """Cor (aproximada) que chega numa entrada: valor fixo, RGB, média de rampa/ruído, mistura... e a imagem, se houver."""
    if not sock.is_linked: return rgb(sock.default_value), None
    if prof > 12: return [.8, .8, .8], None
    n = sock.links[0].from_node
    if n.type == 'RGB': return rgb(n.outputs[0].default_value), None
    if n.type == 'TEX_IMAGE' and n.image: return [1, 1, 1], n
    if n.type == 'VALTORGB':
        el = n.color_ramp.elements; return [sum(e.color[i] for e in el) / len(el) for i in range(3)], None
    if n.type in ('MIX', 'MIX_RGB'):
        ins = [i for i in n.inputs if i.type == 'RGBA']; a, ia = cor_de(ins[0], prof + 1); b, ib = cor_de(ins[1], prof + 1)
        fac = n.inputs[0].default_value if not n.inputs[0].is_linked else .5
        try: fac = float(fac)
        except Exception: fac = .5
        return [a[i] * (1 - fac) + b[i] * fac for i in range(3)], ia or ib
    if n.type == 'TEX_BRICK': return cor_de(n.inputs['Color1'], prof + 1)[0], None
    if n.type == 'GROUP' and n.node_tree:  # grupo próprio: a rampa de cor ou a cor fixa lá dentro
        r = [x for x in n.node_tree.nodes if x.type == 'VALTORGB']
        if r: el = r[0].color_ramp.elements; return [sum(e.color[i] for e in el) / len(el) for i in range(3)], None
        c = [x for x in n.node_tree.nodes if x.type == 'RGB']
        if c: return rgb(c[0].outputs[0].default_value), None
    for i in n.inputs:  # outros nós (vetores, ruído): procura a primeira cor de entrada
        if i.type == 'RGBA': return cor_de(i, prof + 1)
    # ruído com rampa mais abaixo: procura uma rampa na árvore toda
    rampas = [x for x in n.id_data.nodes if x.type == 'VALTORGB']
    if rampas: el = rampas[0].color_ramp.elements; return [sum(e.color[i] for e in el) / len(el) for i in range(3)], None
    return [.8, .8, .8], None

def tem_imagem(m): return m.use_nodes and any(n.type == 'TEX_IMAGE' and n.image for n in m.node_tree.nodes)
def procedural(m):
    if not m or not m.use_nodes or tem_imagem(m): return False
    nt = m.node_tree; em = next((n for n in nt.nodes if n.type == 'EMISSION'), None)
    return bool(em and em.inputs['Color'].is_linked)

# ---- 2a. ASSAR as cores procedurais nos vértices (antes de mexer nos materiais) ----
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 1
try: sc.cycles.device = 'CPU'
except Exception: pass
vis = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render and o.visible_get()]
alvos = [o for o in vis if any(procedural(s.material) for s in o.material_slots)]
bpy.ops.object.select_all(action='DESELECT')
for o in alvos: o.select_set(True)
if alvos:
    bpy.context.view_layer.objects.active = alvos[0]
    bpy.ops.object.make_single_user(object=True, obdata=True, material=False)
    bpy.ops.object.convert(target='MESH')  # modificadores aplicados: o atributo de cor fica na malha final
    for o in alvos:
        me = o.data; a = me.color_attributes.get('cor_assada') or me.color_attributes.new('cor_assada', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = a; me.color_attributes.render_color_index = list(me.color_attributes).index(a)
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='EMIT', target='VERTEX_COLORS')
print('ASSADOS', len(alvos), 'objetos')

feitos = imgs = assados = 0
for m in bpy.data.materials:
    if procedural(m):  # cor já está nos vértices: Emission branca; o Animador multiplica pela cor dos vértices
        nt = m.node_tree; em = next(n for n in nt.nodes if n.type == 'EMISSION'); out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
        for l in list(em.inputs['Color'].links): nt.links.remove(l)
        em.inputs['Color'].default_value = (1, 1, 1, 1); em.inputs['Strength'].default_value = 1.0
        if out and (not em.outputs[0].is_linked or em.outputs[0].links[0].to_node != out): nt.links.new(em.outputs[0], out.inputs['Surface'])
        m['cor_assada'] = True; assados += 1; continue
for m in bpy.data.materials:
    if m.get('cor_assada'): continue
    if not m.use_nodes: continue
    nt = m.node_tree; G = [n for n in nt.nodes if n.type == 'GROUP' and n.node_tree and n.node_tree.name == 'LuzCena']
    em = next((n for n in nt.nodes if n.type == 'EMISSION'), None); out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
    if not em or not out: continue
    if G: cor, img = cor_de(G[0].inputs['Cor']); final = luz_cena(G[0].node_tree, cor)
    else:  # outros cenários (quarto, ginásio): emissão com rampa/ruído/grupos próprios → a cor média que chega na emissão
        if not em.inputs['Color'].is_linked: continue
        final, img = cor_de(em.inputs['Color'])
    # material novo, simples e exportável: Emission com a cor final (ou a imagem tingida)
    for l in list(em.inputs['Color'].links): nt.links.remove(l)
    em.inputs['Color'].default_value = (*final, 1.0); em.inputs['Strength'].default_value = 1.0
    if img:
        nt.links.new(img.outputs['Color'], em.inputs['Color']); imgs += 1
    if not em.outputs[0].is_linked or em.outputs[0].links[0].to_node != out: nt.links.new(em.outputs[0], out.inputs['Surface'])
    feitos += 1

# (nas ruas, Transparente é recorte de imagem, não luz: nada de 'aditivo' aqui; só o assar_cenario.py marca luz de efeito)
bpy.ops.object.select_all(action='DESELECT'); n = 0
for o in bpy.data.objects:
    ok = (not o.hide_render) and o.visible_get() and o.type in ('MESH', 'CAMERA', 'LIGHT', 'EMPTY'); o.select_set(ok); n += ok
bpy.ops.export_scene.gltf(filepath=SAIDA, export_format='GLB', use_selection=True, export_cameras=True, export_lights=True, export_apply=True, export_extras=True,
    export_vertex_color='ACTIVE', export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_image_format='WEBP', export_image_quality=85)
print('CONVERTIDO', SAIDA, 'materiais', feitos, 'com imagem', imgs, 'assados nos vértices', assados, 'objetos', n)
