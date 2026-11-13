"""PACOTE DE FINALIZAÇÃO (o que deixa o vídeo do sapo 'absurdo'), ligado só quando o pedido de vídeo pede:
  {"acabamento": {...}}  no pedido do BLENDER LIGADO (vetor/blender_servidor.py)
- fundo desfocado pela distância (passe de profundidade): cidade/céu desfocam, casas quase nítidas, moitas da frente desfocam
- glow suave nas partes claras
- raios de luz diagonais (plano preso na câmera, entre as casas e os personagens)
- partículas de luz flutuando no ar (pólen), em 3D de verdade (paralaxe)
- vento: copas das árvores dos lotes balançam
- silhuetas escuras e desfocadas no primeiro plano
A grade de cor, a vinheta e a luz de borda dos personagens são feitas fora (vetor/pos_acabamento.py)."""
import math
import os
import random

import bpy
import numpy as np


def _lin(c):
    c = c / 255.0
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92


def _img_rgba(nome, arr):
    """numpy HxWx4 (0..1, linha 0 = topo) -> imagem do Blender"""
    h, w = arr.shape[:2]
    im = bpy.data.images.new(nome, w, h, alpha=True)
    im.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    im.pack()
    return im


def _mat_img(nome, im, forca=1.0):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = im
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = forca
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mx = nt.nodes.new("ShaderNodeMixShader"); o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tx.outputs["Color"], em.inputs["Color"]); nt.links.new(tx.outputs["Alpha"], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs["Surface"])
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        pass
    return m


def _quad(nome, larg, alt, mat, cena):
    me = bpy.data.meshes.new(nome)
    me.from_pydata([(-larg / 2, 0, -alt / 2), (larg / 2, 0, -alt / 2), (larg / 2, 0, alt / 2), (-larg / 2, 0, alt / 2)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = c
    me.materials.append(mat)
    ob = bpy.data.objects.new(nome, me); cena.collection.objects.link(ob)
    return ob


class Acabamento:
    def __init__(self, G, rua, cena, cam, P):
        self.G, self.rua, self.cena, self.cam = G, rua, cena, cam
        cfg = P.get("acabamento") if isinstance(P.get("acabamento"), dict) else {}
        self.cfg = cfg
        self.novos = []
        rnd = random.Random(7)
        S, XS = G["S"], G["XS"]
        c0, c1 = float(P.get("c_ini", P["c_fim"])), float(P["c_fim"])
        x0, x1 = (min(c0, c1) - XS) * S, (max(c0, c1) - XS) * S
        if P.get("cam_quadros"):                       # câmera de outro programa (EP2): o pólen vai onde a câmera passa
            import json as _j
            xs = [c[0] for c in _j.load(open(os.path.join(rua.R, P["cam_quadros"]), encoding="utf-8"))]
            x0, x1 = min(xs) - 2.0, max(xs) + 2.0
        self.xc = (x0 + x1) / 2
        # ---------- compositor: desfoque por distância + glow ----------
        vl = cena.view_layers[0]
        vl.use_pass_z = True
        self._comp_antes = (cena.render.use_compositing, getattr(cena, "compositing_node_group", None))
        g = bpy.data.node_groups.new("acabamento-comp", "CompositorNodeTree")
        g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        n, L = g.nodes, g.links
        rl = n.new("CompositorNodeRLayers"); rl.scene = cena
        out = n.new("NodeGroupOutput")
        img, z = rl.outputs["Image"], rl.outputs["Depth"]

        def faixa(a, b):                                  # 0 em a, 1 em b (com corte)
            mr = n.new("ShaderNodeMapRange"); mr.clamp = True
            mr.inputs["From Min"].default_value = a; mr.inputs["From Max"].default_value = b
            L.new(z, mr.inputs["Value"]); return mr.outputs["Result"]

        def borra(src, px):
            b = n.new("CompositorNodeBlur")
            b.inputs["Size"].default_value = (px, px)
            L.new(src, b.inputs["Image"]); return b.outputs["Image"]

        def mistura(a, b, f):
            m = n.new("ShaderNodeMix"); m.data_type = "RGBA"
            L.new(f, m.inputs["Factor"]); L.new(a, m.inputs[6]); L.new(b, m.inputs[7]); return m.outputs[2]

        longe = mistura(img, borra(img, cfg.get("borra_longe", 9)), faixa(cfg.get("longe_de", 14.0), cfg.get("longe_ate", 40.0)))
        perto = mistura(longe, borra(longe, cfg.get("borra_perto", 14)), faixa(3.4, 2.4))
        gl = n.new("CompositorNodeGlare")
        try:
            gl.inputs["Type"].default_value = "Bloom"
        except Exception:
            pass
        gl.inputs["Threshold"].default_value = cfg.get("glow_limiar", 0.72)
        gl.inputs["Strength"].default_value = cfg.get("glow_forca", 0.55)
        try:
            gl.inputs["Size"].default_value = cfg.get("glow_tamanho", 0.75)
        except Exception:
            pass
        L.new(perto, gl.inputs["Image"])
        L.new(gl.outputs["Image"], out.inputs[0])
        cena.compositing_node_group = g
        cena.render.use_compositing = True
        self.comp = g
        # ---------- raios de luz (plano preso na câmera, a 8 m: na frente das casas, atrás dos personagens) ----------
        H, W = 270, 480
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        ang = math.radians(cfg.get("raio_angulo", 28))
        u = (xx * math.cos(ang) + yy * math.sin(ang))                 # coordenada perpendicular aos raios
        t = (-xx * math.sin(ang) + yy * math.cos(ang))                # ao longo do raio
        raios = np.zeros((H, W), np.float32)
        for c, w, a in ((90, 22, 1.0), (150, 12, 0.6), (210, 30, 0.8), (300, 16, 0.5), (360, 26, 0.7)):
            raios += a * np.exp(-((u - c) / w) ** 2)
        raios *= np.clip(1.15 - t / (H * 1.1), 0, 1) * np.clip((W * 0.75 - xx) / (W * 0.75), 0, 1) ** 0.7
        raios = raios / raios.max() * cfg.get("raio_alfa", 0.16)
        cor = np.array([_lin(v) for v in cfg.get("raio_cor", (255, 236, 190))], np.float32)
        arr = np.dstack([np.broadcast_to(cor[i], (H, W)) for i in range(3)] + [raios])
        mr = _mat_img("acab-raios", _img_rgba("acab-raios", arr), 1.6)
        d = 8.0; larg = d; alt = larg * 1080 / 1920
        ob = _quad("acab-raios", larg * 1.02, alt * 1.02, mr, cena)
        ob.parent = cam; ob.rotation_euler = (math.radians(90), 0, 0)
        ob.location = (0, cam.data.shift_y * larg, -d)
        ob.rotation_euler = (0, 0, 0)
        # o quad foi feito em XZ; preso na câmera precisa ficar no plano XY dela
        for v in ob.data.vertices:
            v.co = (v.co.x, v.co.z, 0.0)
        self.novos.append(ob)
        # ---------- partículas de luz (pólen) ----------
        Hp = 64
        yy, xx = np.mgrid[0:Hp, 0:Hp].astype(np.float32)
        r = np.hypot(xx - Hp / 2 + 0.5, yy - Hp / 2 + 0.5) / (Hp / 2)
        a = np.clip(1 - r, 0, 1) ** 2
        cp = np.array([_lin(v) for v in (255, 246, 200)], np.float32)
        mp = _mat_img("acab-polen", _img_rgba("acab-polen", np.dstack([np.full((Hp, Hp), cp[0]), np.full((Hp, Hp), cp[1]), np.full((Hp, Hp), cp[2]), a])), 2.2)
        self.part = []
        for i in range(cfg.get("particulas", 140)):
            s = rnd.uniform(0.025, 0.07)
            py0, py1 = cfg.get("polen_y", (2.6, 14.0))
            base = (rnd.uniform(x0 - 8, x1 + 8), rnd.uniform(py0, py1), rnd.uniform(0.2, 3.2))
            frente = base[1] < cfg.get("frente_d", -1)      # na frente dos personagens -> camada da frente (transparente)
            ob = _quad(f"acab-polen{'F' if frente else ''}{i}", s, s, mp, cena)
            self.part.append((ob, base, rnd.uniform(0, 6.28), rnd.uniform(0.4, 1.0)))
            self.novos.append(ob)
        # ---------- vento nas copas (raízes dos itens dos lotes) ----------
        self.arvores = [(o, o.rotation_euler.copy(), rnd.uniform(0, 6.28)) for o in bpy.data.objects
                        if o.type == "EMPTY" and o.name.startswith("lote") and "-item" in o.name and o.users_scene]
        # ---------- silhuetas escuras no primeiro plano ----------
        sil = cfg.get("silhuetas", [])
        if sil:
            import rua_vivo_lib
            for k, (xs, modelo) in enumerate(sil):
                caminho = os.path.join(rua.R, modelo)
                if not os.path.exists(caminho):
                    continue
                objs, raiz = rua_vivo_lib._carrega_blend(caminho, cena, f"acab-sil{k}")
                raiz.scale = (1.1, 1.1, 1.1)
                bpy.context.view_layer.update()
                _, zmin, _ = rua_vivo_lib._base(objs)
                raiz.location = (xs, cfg.get("silhueta_d", 1.9), -zmin)
                rua_vivo_lib._tinge(objs, (22, 30, 34), 0.93)
                self.novos += objs + [raiz]

    def quadro(self, q, C):
        t = q / 24.0
        for ob, (bx, by, bz), fase, vel in self.part:
            ob.location = (bx + 0.25 * math.sin(t * 0.5 * vel + fase) + 0.05 * t,
                           by + 0.15 * math.sin(t * 0.3 + fase * 2),
                           bz + 0.18 * math.sin(t * 0.7 * vel + fase) + 0.04 * t)
        for o, r0, fase in self.arvores:
            o.rotation_euler = (r0.x, r0.y + math.radians(1.1) * math.sin(t * 1.3 + fase), r0.z)

    def desliga(self):
        for o, r0, _ in self.arvores:
            o.rotation_euler = r0
        for o in self.novos:
            try:
                bpy.data.objects.remove(o, do_unlink=True)
            except Exception:
                pass
        self.cena.render.use_compositing, grupo = self._comp_antes
        try:
            self.cena.compositing_node_group = grupo
        except Exception:
            pass
        try:
            bpy.data.node_groups.remove(self.comp)
        except Exception:
            pass
