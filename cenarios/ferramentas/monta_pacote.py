# monta cenarios/<id>/cenario.json a partir das camadas geradas (base.json) + a arrumação da equipe (editor do Planetário, db cena/layout)
# uso: python3 monta_pacote.py <saida com base.json e camadas/> <layout.json> <pasta do pacote no repo>
import json, sys, shutil, os
saida, layout, dest = sys.argv[1:4]
base = json.load(open(f'{saida}/base.json')); lay = json.load(open(layout)); E = lay['camadas']; G = lay['cena']
cams = base['camadas']; ordem = [c['id'] for c in cams]
out = sorted([c for c in cams if not E.get(c['id'], {}).get('del')], key=lambda c: E.get(c['id'], {}).get('z', 0))
for c in cams:  # as que a equipe excluiu entram desligadas, no lugar de antes
    if E.get(c['id'], {}).get('del'):
        i = ordem.index(c['id']); ant = [x for x in ordem[:i] if x in [o['id'] for o in out]]
        out.insert([o['id'] for o in out].index(ant[-1]) + 1 if ant else 0, c)
res = []
for c in out:
    e = E.get(c['id'], {})
    d = {'id': c['id'], 'nome': c['nome'], 'arq': c['arq'], 'tipo': c['tipo'], 'w': c['w'], 'h': c['h'],
         'cx': e.get('cx', c['x'] + c['w']/2), 'cy': e.get('cy', c['y'] + c['h']/2), 's': round(e.get('s', 1), 4), 'r': e.get('r', 0)}
    if e.get('flip'): d['flip'] = True
    if not (e.get('vis', not c.get('oculta')) and not e.get('del')): d['oculta'] = True
    if e.get('lock') or c.get('travada'): d['trava'] = True
    fx = e.get('fx')
    if fx and (fx['luz'], fx['con'], fx['sat'], fx['mat']) != (100, 100, 100, 0): d['fx'] = {k: fx[k] for k in ('luz', 'con', 'sat', 'mat')}
    res.append(d)
j = {'formato': 'cenario-camadas', 'v': 1, 'id': 'planetario', 'nome': 'Planetário do Problems', 'estilo': 'pintado-azul',
     'descricao': 'Quarto-planetário azul do Problems, pintado com luz e profundidade (ponto de fuga, sombras, primeiro plano desfocado).',
     'tags': ['quarto', 'Problems', 'azul', 'gelo'], 'w': 1920, 'h': 1080, 'miniatura': 'miniatura.jpg',
     'cena': {k: G[k] for k in ('luz', 'con', 'sat', 'mat')}, 'camadas': res}
shutil.rmtree(f'{dest}/camadas', ignore_errors=True); shutil.copytree(f'{saida}/camadas', f'{dest}/camadas')
json.dump(j, open(f'{dest}/cenario.json', 'w'), ensure_ascii=False, indent=1)
print(len(res), 'camadas,', sum(1 for r in res if r.get('oculta')), 'desligadas')
