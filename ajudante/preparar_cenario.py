# preparar_cenario.py — usado pela ponte (POST /converter): escolhe o conversor certo para o .blend e gera o .glb do Animador.
# blender -b <entrada.blend> -P preparar_cenario.py -- <saida.glb> <progresso.json>
#  - rua grande (grupo de cor "LuzCena" ou mais de 150 peças): converter_cenario.py (calcula a cor de cada material, rápido)
#  - cenário pequeno (até 150 peças): assar_cenario.py (assa a cor de cada peça numa imagem, ~1 min)
import bpy, sys, os, json, runpy, time
argv = sys.argv[sys.argv.index('--') + 1:]
SAIDA, PROG = argv[0], argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
def anota(**k): json.dump(k, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False)
t0 = time.time()
try:
    vis = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render and o.visible_get()]
    modo = 'converter' if (bpy.data.node_groups.get('LuzCena') or len(vis) > 150) else 'assar'
    anota(estado='convertendo', modo=modo, pecas=len(vis))
    sys.argv = [sys.argv[0], '--', SAIDA] + (['1024'] if modo == 'assar' else [])
    runpy.run_path(os.path.join(AQUI, modo + ('_cenario.py')), run_name='__main__')
    if not os.path.exists(SAIDA): raise RuntimeError('o .glb não foi gerado')
    anota(estado='pronto', modo=modo, pecas=len(vis), mb=round(os.path.getsize(SAIDA) / 1048576, 1), seg=round(time.time() - t0))
except Exception as e:
    anota(estado='erro', erro=str(e)[:400])
    raise
