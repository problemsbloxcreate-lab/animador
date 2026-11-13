"""Renderiza UM trecho de um cenário seguindo a câmera do Estúdio, direto em vídeo (sem ffmpeg, sem sequência de PNG).
Chamado pela ponte:  blender -b <cenario.blend> -P render_cenario.py -- <pedido.json>
pedido.json: {"cenario": "rua-escola", "quadros": [[cx, cy, zoom], ...], "w": 1920, "h": 1080, "fps": 24,
              "escala": 100, "ancora": "Casa do Problems", "pasta": "<saída>"}
Saída na pasta: fundo.mp4 (H.264), frente.webm (VP9 com transparência, só se o cenário tiver coisas na frente) e progresso.json."""
import json
import os
import sys
import time

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
P = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
CFG = json.load(open(os.path.join(AQUI, "cenarios.json"), encoding="utf-8"))[P["cenario"]]
OUT = P["pasta"]; os.makedirs(OUT, exist_ok=True)
Q = P["quadros"]; N = len(Q); W, H = float(P.get("w", 1920)), float(P.get("h", 1080))
cena = bpy.context.scene; cam = cena.camera
t0 = time.time()
estado = {"estado": "renderizando", "feito": 0, "total": N, "camada": "fundo", "camadas": 1, "seg": 0}


def grava(**k):
    estado.update(k); estado["seg"] = round(time.time() - t0, 1)
    tmp = os.path.join(OUT, "progresso.tmp"); json.dump(estado, open(tmp, "w")); os.replace(tmp, os.path.join(OUT, "progresso.json"))


# ---------- câmera do Estúdio -> câmera do Blender ----------
cams = []
if CFG["modo"] == "trilho":                       # câmera anda pela rua (EP2): pan vira deslocamento de verdade
    k, D, Y = CFG["k"], CFG["D"], CFG["Y"]
    ax = CFG["ancoras"].get(P.get("ancora") or CFG["ancora_padrao"], CFG["ancoras"][CFG["ancora_padrao"]])
    for cx, cy, z in Q:
        cams.append(dict(loc=(ax + (cx - CFG["centro_x"]) * k, Y, (CFG["pe_y"] - cy) * k), lens=36.0 * (D - Y) / ((W / z) * k), sx=0.0, sy=0.0))
else:                                             # câmera fixa: pan = deslocar o quadro (shift), zoom = lente
    loc0 = tuple(cam.location)
    for cx, cy, z in Q:
        cams.append(dict(loc=loc0, lens=CFG["lente"] * z, sx=z * (cx - W / 2) / W, sy=z * ((H / 2 - cy) / W + CFG["shift_y"])))
json.dump([[c["loc"][0], c["loc"][2], c["lens"], c["loc"][1]] for c in cams], open(os.path.join(OUT, "cam_quadros.json"), "w"))

# ---------- acabamento (pólen, brilho, desfoque do fundo): só onde o cenário pede ----------
extras = []
if CFG.get("acabamento"):
    import acabamento

    class _Rua:
        R = OUT
    ac = acabamento.Acabamento({"S": 1.0, "XS": 0.0}, _Rua, cena, cam,
                               {"c_fim": 0, "cam_quadros": "cam_quadros.json", "acabamento": CFG["acabamento"]})
    extras.append(ac)


def prepara(cena_, *a):
    q = min(max(cena_.frame_current, 0), N - 1); c = cams[q]
    cam.location = c["loc"]; cam.data.lens = c["lens"]; cam.data.shift_x = c["sx"]; cam.data.shift_y = c["sy"]
    for x in extras:
        x.quadro(q, 0)


def depois(cena_, *a):
    grava(feito=min(cena_.frame_current + 1, N))


r = cena.render
r.fps, r.fps_base = int(P.get("fps", 24)), 1.0
r.resolution_x, r.resolution_y, r.resolution_percentage = int(W), int(H), int(P.get("escala", 100))
r.use_lock_interface = True
cena.frame_start, cena.frame_end = 0, N - 1
for h in (bpy.app.handlers.frame_change_pre, bpy.app.handlers.render_post):
    h.clear()
bpy.app.handlers.frame_change_pre.append(prepara)
bpy.app.handlers.render_post.append(depois)

frente_obj = lambda o: o.name.startswith(("acab-sil", "acab-polenF")) or (o.parent is not None and o.parent.name.startswith("acab-sil"))
tem_frente = bool(CFG.get("frente")) and any(frente_obj(o) for o in cena.objects)
camadas = ["fundo"] + (["frente"] if tem_frente else [])


def passe(camada):
    escondidos = []
    if tem_frente:
        for o in cena.objects:
            if o.type in ("CAMERA", "LIGHT", "EMPTY"):
                continue
            esc = frente_obj(o) if camada == "fundo" else not frente_obj(o)
            if esc and not o.hide_render:
                o.hide_render = True; escondidos.append(o)
    im = r.image_settings
    try:
        im.media_type = "VIDEO"
    except Exception:
        pass
    im.file_format = "FFMPEG"
    f = r.ffmpeg
    if camada == "fundo":
        r.film_transparent = False
        f.format, f.codec = "MPEG4", "H264"; im.color_mode = "RGB"
        nome = "fundo.mp4"
    else:
        r.film_transparent = True
        f.format, f.codec = "WEBM", "WEBM"; im.color_mode = "RGBA"
        nome = "frente.webm"
    try:
        f.constant_rate_factor = "HIGH"
    except Exception:
        pass
    f.audio_codec = "NONE"
    r.use_file_extension = False
    destino = os.path.join(OUT, nome)
    r.filepath = destino
    grava(camada=camada, feito=0, camadas=len(camadas))
    cena.frame_set(0)
    bpy.ops.render.render(animation=True)
    for o in escondidos:
        o.hide_render = False
    return nome


try:
    feitos = [passe(c) for c in camadas]
    grava(estado="pronto", feito=N, arquivos=feitos)
except Exception as e:
    import traceback; traceback.print_exc()
    grava(estado="erro", erro=str(e))
