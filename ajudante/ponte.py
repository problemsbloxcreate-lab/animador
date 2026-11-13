"""PONTE ESTÚDIO -> BLENDER. Roda dentro do próprio Blender (não precisa de Python instalado):
    blender -b --factory-startup -P ponte.py          (ou dois cliques em LIGAR-PONTE.bat)
Fica ouvindo em http://127.0.0.1:8810 (só este computador). O botão "Renderizar cenário (Blender)…" do Estúdio
manda a câmera do trecho; a ponte renderiza UM pedido por vez (outro Blender em segundo plano) e devolve os vídeos.
  GET  /estado                 -> cenários disponíveis + fila
  POST /render  {cenario, quadros:[[cx,cy,zoom]...], w, h, fps, escala, ancora}  -> {id}
  GET  /trabalho/<id>          -> progresso
  GET  /arquivo/<id>/<nome>    -> fundo.mp4 / frente.webm
  POST /cancelar/<id>
  POST /converter?nome=<nome>  (corpo = o .blend)  -> {id}   [13/11: cenário .blend vira .glb do Animador ao vivo]
  GET  /arquivo/<id>/saida.glb  -> o cenário convertido"""
import json
import os
import shutil
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
TRAB = os.path.join(AQUI, "trabalhos")
os.makedirs(TRAB, exist_ok=True)
PORTA = 8810
VERSAO = 3  # 2 = também converte .blend em .glb (POST /converter); 3 = AJUDANTE DO BLENDER (instalador, ligado pelo Estúdio, se atualiza sozinho)
# AJUDANTE (13/11/2026, pedido da dona): instalado por "Instalar ajudante do Blender.cmd" na pasta EstudioProblems/ajudante dentro de LOCALAPPDATA.
# Não liga com o Windows: o Estúdio liga quando precisa (link estudio-blender://ligar). Fica escondido (sem janela) e se desliga
# sozinho depois de 3 horas sem nenhum pedido. Ao ligar, baixa a versão nova dos scripts do site (vale a partir da próxima vez).
SITE = "https://problemsbloxcreate-lab.github.io/animador/ajudante"
ARQS = ["ponte.py", "converter_cenario.py", "assar_cenario.py", "preparar_cenario.py", "render_cenario.py", "acabamento.py", "cenarios.json", "versao.txt"]
ULTIMO = [time.time()]
OCIOSO = 3 * 3600
ORIGENS = ("https://estudio.problemsraiz.workers.dev", "http://localhost", "http://127.0.0.1")
BLENDER = bpy.app.binary_path
fila, jobs, trava = [], {}, threading.Lock()


PASTAS_BLEND = [AQUI, os.path.join(os.path.expanduser("~"), "Documents", "Problems", "cenarios-problems")]  # o ajudante também usa a pasta antiga dos cenários


def blend_de(v):
    """Caminho do .blend de um cenário: na pasta do ajudante ou na pasta antiga (Documentos/Problems/cenarios-problems)."""
    return next((os.path.join(d, v["arquivo"]) for d in PASTAS_BLEND if os.path.exists(os.path.join(d, v["arquivo"]))), None)


def cenarios():
    c = json.load(open(os.path.join(AQUI, "cenarios.json"), encoding="utf-8"))
    return {k: v for k, v in c.items() if blend_de(v)}


def progresso(j):
    try:
        p = json.load(open(os.path.join(j["pasta"], "progresso.json")))
    except Exception:
        p = {"feito": 0, "total": j["total"], "camada": "fundo", "camadas": 1}
    p.update({k: j[k] for k in ("id", "cenario", "total", "criado") if k in j})
    p["estado"] = j["estado"]                       # quem manda é a ponte (o arquivo do Blender só dá o andamento)
    if j["estado"] == "erro":
        p["erro"] = j.get("erro", p.get("erro"))
    if j["estado"] == "fila":
        p["na_frente"] = fila.index(j["id"]) if j["id"] in fila else 0
    return p


def trabalhador():
    while True:
        with trava:
            jid = fila.pop(0) if fila else None
        if not jid:
            time.sleep(0.3); continue
        j = jobs[jid]
        if j["estado"] == "cancelado":
            continue
        j["estado"] = "renderizando"
        cfg = cenarios()[j["cenario"]]
        log = open(os.path.join(j["pasta"], "blender.log"), "w", encoding="utf-8", errors="replace")
        j["proc"] = subprocess.Popen([BLENDER, "-b", blend_de(cfg), "-P", os.path.join(AQUI, "render_cenario.py"),
                                      "--", os.path.join(j["pasta"], "pedido.json")], stdout=log, stderr=subprocess.STDOUT, cwd=AQUI)
        print(f"[ponte] renderizando {jid} ({j['cenario']}, {j['total']} quadros)", flush=True)
        j["proc"].wait(); log.close()
        try:
            p = json.load(open(os.path.join(j["pasta"], "progresso.json")))
        except Exception:
            p = {}
        if j["estado"] == "cancelado":
            continue
        if p.get("estado") == "pronto":
            j["estado"] = "pronto"; print(f"[ponte] pronto {jid} em {p.get('seg')} s", flush=True)
        else:
            j["estado"] = "erro"; j["erro"] = p.get("erro") or "o Blender fechou no meio (veja blender.log na pasta do trabalho)"
            print(f"[ponte] ERRO {jid}: {j['erro']}", flush=True)


fila_conv = []


def conversor():
    while True:
        with trava:
            jid = fila_conv.pop(0) if fila_conv else None
        if not jid:
            time.sleep(0.3); continue
        j = jobs[jid]; j["estado"] = "convertendo"
        log = open(os.path.join(j["pasta"], "blender.log"), "w", encoding="utf-8", errors="replace")
        j["proc"] = subprocess.Popen([BLENDER, "-b", os.path.join(j["pasta"], "entrada.blend"), "-P", os.path.join(AQUI, "preparar_cenario.py"),
                                      "--", os.path.join(j["pasta"], "saida.glb"), os.path.join(j["pasta"], "progresso.json")], stdout=log, stderr=subprocess.STDOUT, cwd=AQUI)
        print(f"[ponte] convertendo {jid} ({j['nome']})", flush=True)
        j["proc"].wait(); log.close()
        try:
            p = json.load(open(os.path.join(j["pasta"], "progresso.json"), encoding="utf-8"))
        except Exception:
            p = {}
        j.update({k: p[k] for k in ("modo", "pecas", "mb", "seg") if k in p})
        if p.get("estado") == "pronto" and os.path.exists(os.path.join(j["pasta"], "saida.glb")):
            j["estado"] = "pronto"; print(f"[ponte] convertido {jid} em {p.get('seg')} s ({p.get('mb')} MB, {p.get('modo')})", flush=True)
        else:
            j["estado"] = "erro"; j["erro"] = p.get("erro") or "o Blender fechou no meio (veja blender.log na pasta do trabalho)"
            print(f"[ponte] ERRO ao converter {jid}: {j['erro']}", flush=True)


def limpa_antigos():
    ds = sorted((d for d in os.listdir(TRAB) if os.path.isdir(os.path.join(TRAB, d))), key=lambda d: os.path.getmtime(os.path.join(TRAB, d)))
    for d in ds[:-8]:                               # guarda só os 8 últimos
        if d not in jobs or jobs[d]["estado"] in ("pronto", "erro", "cancelado"):  # conversão em andamento também fica
            shutil.rmtree(os.path.join(TRAB, d), ignore_errors=True); jobs.pop(d, None)


def atualiza():
    """Baixa os scripts novos do site quando a versão de lá é maior (vale na próxima vez que o ajudante ligar)."""
    import urllib.request
    try:
        local = int(open(os.path.join(AQUI, "versao.txt")).read().strip() or 0)
        remoto = int(urllib.request.urlopen(SITE + "/versao.txt", timeout=15).read().decode().strip() or 0)
        if remoto <= local:
            return
        for f in ARQS:
            dados = urllib.request.urlopen(SITE + "/" + f, timeout=60).read()
            tmp = os.path.join(AQUI, f + ".novo"); open(tmp, "wb").write(dados); os.replace(tmp, os.path.join(AQUI, f))
        print(f"[ajudante] atualizado para a versão {remoto} (vale na próxima vez)", flush=True)
    except Exception as e:
        print("[ajudante] sem atualizar agora:", e, flush=True)


def vigia():
    """Desliga depois de OCIOSO segundos sem pedidos e sem trabalho em andamento (o Estúdio liga de novo quando precisar)."""
    while True:
        time.sleep(60)
        ocupado = fila or fila_conv or any(j["estado"] in ("renderizando", "convertendo") for j in jobs.values())
        if not ocupado and time.time() - ULTIMO[0] > OCIOSO:
            print("[ajudante] parado há muito tempo: desligando", flush=True); os._exit(0)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        ULTIMO[0] = time.time()

    def _cors(self):
        o = self.headers.get("Origin") or ""
        if o.startswith(ORIGENS):
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def _origem_ok(self):
        o = self.headers.get("Origin")
        return o is None or o.startswith(ORIGENS)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if not self._origem_ok():
            return self._json({"erro": "origem não permitida"}, 403)
        p = self.path.split("?")[0].strip("/").split("/")
        if p[0] == "estado":
            cs = cenarios()
            return self._json({"versao": VERSAO, "ajudante": True, "blender": bpy.app.version_string,
                               "cenarios": [{"id": k, "nome": v["nome"], "modo": v["modo"], "ancoras": list(v.get("ancoras", {})),
                                             "ancora_padrao": v.get("ancora_padrao"), "nota": v.get("nota", "")} for k, v in cs.items()],
                               "fila": [progresso(jobs[i]) for i in fila],
                               "atual": next((progresso(j) for j in jobs.values() if j["estado"] == "renderizando"), None)})
        if p[0] == "trabalho" and len(p) > 1 and p[1] in jobs and jobs[p[1]].get("tipo") == "converter":
            j = jobs[p[1]]
            return self._json({k: j.get(k) for k in ("id", "estado", "nome", "modo", "pecas", "mb", "seg", "erro")} | {"na_frente": fila_conv.index(j["id"]) if j["id"] in fila_conv else 0})
        if p[0] == "trabalho" and len(p) > 1 and p[1] in jobs:
            return self._json(progresso(jobs[p[1]]))
        if p[0] == "arquivo" and len(p) > 2 and p[1] in jobs and p[2] in ("fundo.mp4", "frente.webm", "saida.glb"):
            f = os.path.join(jobs[p[1]]["pasta"], p[2])
            if not os.path.exists(f):
                return self._json({"erro": "ainda não existe"}, 404)
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "model/gltf-binary" if p[2].endswith("glb") else "video/mp4" if p[2].endswith("mp4") else "video/webm")
            self.send_header("Content-Length", str(os.path.getsize(f))); self.end_headers()
            with open(f, "rb") as fh:
                shutil.copyfileobj(fh, self.wfile)
            return
        self._json({"erro": "não achei"}, 404)

    def do_POST(self):
        if not self._origem_ok():
            return self._json({"erro": "origem não permitida"}, 403)
        p = self.path.split("?")[0].strip("/").split("/")
        if p[0] == "converter":
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 600 * 1024 * 1024:
                return self._json({"erro": "mande o arquivo .blend (até 600 MB)"}, 400)
            dados = self.rfile.read(n)
            if dados[:7] != b"BLENDER" and dados[:4] != bytes([0x28, 0xB5, 0x2F, 0xFD]) and dados[:2] != bytes([0x1F, 0x8B]):  # .blend puro, comprimido (zstd) ou antigo (gzip)
                return self._json({"erro": "isso não é um arquivo .blend"}, 400)
            from urllib.parse import parse_qs, urlparse, unquote
            nome = unquote((parse_qs(urlparse(self.path).query).get("nome") or ["cenario"])[0])[:80]
            limpa_antigos()
            jid = time.strftime("%H%M%S") + "-c" + uuid.uuid4().hex[:5]
            pasta = os.path.join(TRAB, jid); os.makedirs(pasta)
            open(os.path.join(pasta, "entrada.blend"), "wb").write(dados)
            with trava:
                jobs[jid] = {"id": jid, "tipo": "converter", "nome": nome, "pasta": pasta, "estado": "fila", "criado": time.time()}
                fila_conv.append(jid)
            return self._json({"id": jid})
        try:
            corpo = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        except Exception:
            return self._json({"erro": "pedido inválido"}, 400)
        if p[0] == "render":
            cs = cenarios()
            if corpo.get("cenario") not in cs:
                return self._json({"erro": "cenário desconhecido: " + str(corpo.get("cenario"))}, 400)
            q = corpo.get("quadros") or []
            if not q or len(q) > 20000 or any(len(x) < 3 for x in q):
                return self._json({"erro": "quadros da câmera inválidos"}, 400)
            limpa_antigos()
            jid = time.strftime("%H%M%S") + "-" + uuid.uuid4().hex[:6]
            pasta = os.path.join(TRAB, jid); os.makedirs(pasta)
            ped = {"cenario": corpo["cenario"], "quadros": [[float(a), float(b), float(c)] for a, b, c, *_ in q],
                   "w": int(corpo.get("w", 1920)), "h": int(corpo.get("h", 1080)), "fps": int(corpo.get("fps", 24)),
                   "escala": max(10, min(100, int(corpo.get("escala", 100)))), "ancora": corpo.get("ancora"), "pasta": pasta}
            json.dump(ped, open(os.path.join(pasta, "pedido.json"), "w", encoding="utf-8"), ensure_ascii=False)
            with trava:
                jobs[jid] = {"id": jid, "cenario": ped["cenario"], "pasta": pasta, "total": len(q), "estado": "fila", "criado": time.time()}
                fila.append(jid)
            return self._json({"id": jid})
        if p[0] == "cancelar" and len(p) > 1 and p[1] in jobs:
            j = jobs[p[1]]
            with trava:
                if p[1] in fila:
                    fila.remove(p[1])
            j["estado"] = "cancelado"
            if j.get("proc") and j["proc"].poll() is None:
                j["proc"].kill()
            return self._json({"ok": True})
        self._json({"erro": "não achei"}, 404)


class Servidor(ThreadingHTTPServer):
    allow_reuse_address = False  # no Windows a reutilização deixava DUAS cópias na mesma porta

    def server_bind(self):
        import socket
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


try:
    servidor = Servidor(("127.0.0.1", PORTA), H)
except OSError:
    print("[ajudante] já está ligado neste computador", flush=True); os._exit(0)  # duas cópias: a segunda sai quieta
threading.Thread(target=trabalhador, daemon=True).start()
threading.Thread(target=conversor, daemon=True).start()
threading.Thread(target=vigia, daemon=True).start()
threading.Thread(target=atualiza, daemon=True).start()
print(f"[ajudante] LIGADO em http://127.0.0.1:{PORTA}  (Blender {bpy.app.version_string}) — cenários: {', '.join(cenarios())}", flush=True)
servidor.serve_forever()
