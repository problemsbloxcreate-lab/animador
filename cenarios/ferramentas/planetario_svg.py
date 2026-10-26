# Planetário do Problems em VETOR: cada camada do camadas.py vira um SVG (fotos embutidas só onde são fotos).
# Rode de dentro de planet/:  python3 vetor/camadas_svg.py  → vetor/saida/camadas/*.svg|png + vetor/saida/base.json
import sys, os, json, math, random
sys.path.insert(0, os.path.dirname(__file__))
import svglib as V
from svglib import *
from PIL import Image, ImageOps

OUT = 'vetor/saida/camadas'; os.makedirs(OUT, exist_ok=True)
BASE = json.load(open('site/camadas.json'))           # tamanhos/posições finais (a arrumação da equipe usa estes tamanhos)
POS = {c['id']: c for c in BASE['camadas']}
GRUPOS = {
  'estante': ['estante','boneco0','boneco1','boneco2','boneco3','boneco4','boneco5','cristais','floco','caixa_saturno','quadro_irma','quadro_amarelo','caixas3','prat4','carta'],
  'movel': ['movel','movel_itens','planeta_laranja','planeta_verde','planeta_azul_claro','planeta_vermelho','planeta_rosa','planeta_amarelo'],
  'quadro': ['quadro_planeta','quadro_planeta2'],
}
ARR = {'estante': (.84, (-20, 920), (80, 918)), 'movel': (.84, (690, 965), (790, 962)), 'quadro': (.74, (945, 310), (1227, 318))}
def grupo(id_):
    for g, ids in GRUPOS.items():
        if id_ in ids: return ARR[g]
    return (1, (0, 0), (0, 0))
def png_pronto(id_, nome):  # foto pura (os bonecos): fica PNG, a mesma do editor (já com sombra e luz)
    c = POS[id_]; Image.open(f'site/camadas/{id_}.png').save(f'{OUT}/{id_}.png', optimize=True)
    CAM.append({'id': id_, 'nome': nome, 'arq': f'camadas/{id_}.png', 'tipo': 'png', 'x': c['x'], 'y': c['y'], 'w': c['w'], 'h': c['h']})
CAM = []
# camadas que em SVG não ficaram iguais à PNG aprovada (textura pintada, geada borrada, letras, estrelas sorteadas): ficam PNG
MANTER_PNG = {'fundo', 'gelo_parede', 'floco', 'carta', 'caderno', 'quadro_planeta', 'quadro_planeta2'}
def camada(id_, nome, fn, rot=0, blur=0, luz=True, tipo='svg'):
    if id_ in MANTER_PNG: return png_pronto(id_, nome)
    c = POS[id_]; k, (ox, oy), (nx, ny) = grupo(id_)
    mapa = lambda x, y: (nx + (x-ox)*k, ny + (y-oy)*k)
    if rot:  # o quadro girado: a caixa final é a girada; volta para a origem pelo centro
        cxf, cyf = c['x'] + c['w']/2, c['y'] + c['h']/2
        cx0, cy0 = (cxf-nx)/k + ox, (cyf-ny)/k + oy; vw, vh = c['w']/k, c['h']/k; caixa = (cx0-vw/2, cy0-vh/2, vw, vh)
    else: caixa = ((c['x']-nx)/k + ox, (c['y']-ny)/k + oy, c['w']/k, c['h']/k)
    nova(); fn()
    txt = svg(caixa, c['w'], c['h'], mapa, rot=rot, blur=blur, luz=luz)
    open(f'{OUT}/{id_}.svg', 'w').write(txt)
    CAM.append({'id': id_, 'nome': nome, 'arq': f'camadas/{id_}.svg', 'tipo': 'svg', 'x': c['x'], 'y': c['y'], 'w': c['w'], 'h': c['h'],
                **({'travada': True} if c.get('travada') else {}), **({'oculta': True} if c.get('oculta') else {})})
    print(id_, len(txt)//1024, 'KB')

# =============== FUNDO: parede com luz + pinceladas, chão de azulejo ===============
def fundo():
    S['VP'] = (1000, 470)
    # degradê da parede: t = clip(.7 x/W + .6 (1-y/H) - .15)^1.2  (escuro embaixo à esquerda, claro em cima à direita)
    gx, gy = .7/W, -.6/H; n = math.hypot(gx, gy); ux, uy = gx/n, gy/n
    c0 = (960, 540); D = 1200
    p1 = (c0[0]-ux*D, c0[1]-uy*D); p2 = (c0[0]+ux*D, c0[1]+uy*D)
    tv = lambda p: .7*p[0]/W + .6*(1-p[1]/H) - .15
    t1, t2 = tv(p1), tv(p2); stops = ''
    a, b = hx('#101a55'), hx('#8cc8ff')
    for i in range(13):
        s = i/12; t = t1 + (t2-t1)*s; tt = max(0, min(1, t))**1.2
        stops += f'<stop offset="{f(s)}" stop-color="{hexd(tuple(a[j]*(1-tt)+b[j]*tt for j in range(3)))}"/>'
    i = V.C.id('g')
    V.C.defs.append(f'<linearGradient id="{i}" gradientUnits="userSpaceOnUse" x1="{f(p1[0])}" y1="{f(p1[1])}" x2="{f(p2[0])}" y2="{f(p2[1])}">{stops}</linearGradient>')
    pinta(R(-20, -20, 1940, 1100), ('url', i))
    # pinceladas diagonais (ruído esticado e girado -28°) + manchas grandes, bem de leve
    fi = V.C.id('fp')
    V.C.defs.append(f'<filter id="{fi}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
                    f'<feTurbulence type="fractalNoise" baseFrequency="0.0022 0.03" numOctaves="4" seed="7"/>'
                    f'<feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.74  0 0 0 0 1  2.4 0 0 0 -1.25"/></filter>')
    fd = V.C.id('fp')
    V.C.defs.append(f'<filter id="{fd}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
                    f'<feTurbulence type="fractalNoise" baseFrequency="0.0022 0.03" numOctaves="4" seed="7"/>'
                    f'<feColorMatrix type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.04  0 0 0 0 0.2  -2.4 0 0 0 1.12"/></filter>')
    V.C.add(f'<g transform="rotate(-28 960 540)"><rect x="-700" y="-700" width="3320" height="2480" filter="url(#{fi})" opacity=".22"/>'
            f'<rect x="-700" y="-700" width="3320" height="2480" filter="url(#{fd})" opacity=".22"/></g>')
    fm = V.C.id('fp')
    V.C.defs.append(f'<filter id="{fm}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
                    f'<feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="2" seed="3"/>'
                    f'<feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 0.75  0 0 0 0 1  0 0 0 -1.6 0.95"/></filter>')
    V.C.add(f'<rect x="0" y="0" width="1920" height="1080" filter="url(#{fm})" opacity=".1"/>')
    # chão
    y = 915; vx, vy = S['VP']
    pinta(R(-10, y, 1930, 1080), vg('#2b4aa0', '#121c50', y, 1080))
    cl = recorte(R(-10, y, 1930, 1080)); linhas = []
    for x in range(-2000, 4000, 210):
        k = (1080-y)/(1080-vy); b2 = (x + (vx-x)*k, y); linhas.append(L([(x, 1080), b2], 2).d)
    yy = y; dy = 26
    while yy < 1080: linhas.append(L([(-10, yy), (1930, yy)], 2).d); dy *= 1.5; yy += dy
    pinta(Forma(' '.join(linhas), [(0, 0)], 2), '#0a1033', .26, clip=cl)
    pinta(R(-10, y-14, 1930, y+3), vg('#8fb0ee', '#4a63b8', y-14, y+3))
camada('fundo', 'Parede e chão', fundo)

# =============== testes de parede ===============
def estrelas_parede():
    for (x, y, r, ang) in ((760, 120, 16, -10), (905, 62, 12, 15), (835, 238, 10, 5), (1010, 70, 15, 20), (690, 290, 11, -15), (1480, 330, 13, 8)):
        fm = P(estrela_pts(x, y, r, .45, -90 + ang))
        pinta(fm, '#d8ffb0', .55, blur=r*.7)
        pinta(fm, vg('#f4ffd8', '#c8f59a', y-r, y+r)); traco(fm, '#5f8a3a', 1, .6)
camada('estrelas', 'Estrelas que brilham (teste)', estrelas_parede)
def gelo_parede():
    rnd = random.Random(11)
    def borda(x):
        al = max(0, min(1, (x-1480)/440))**.8
        return 40 + 190*al + 18*math.sin(x/31) + 10*math.sin(x/11 + 2), al
    pts = [(1480, -10)] + [(x, borda(x)[0]) for x in range(1480, 1925, 5)] + [(1925, -10)]
    pend = []
    for i, x in enumerate(range(1500, 1920, 34)):
        x = x + rnd.uniform(-8, 8); yb, al = borda(x); Lp = rnd.uniform(26, 70)*(.4 + al)
        pend.append(P([(x-9, yb-4), (x+9, yb-4), (x+1, yb+Lp)]))
    tudo = junta(P(pts), *pend)
    gi = V.C.id('g')
    V.C.defs.append(f'<linearGradient id="{gi}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="320"><stop offset="0" stop-color="#ffffff" stop-opacity=".85"/>'
                    f'<stop offset=".6" stop-color="#d9f2fd" stop-opacity=".72"/><stop offset="1" stop-color="#c6ecfc" stop-opacity=".45"/></linearGradient>')
    oi = V.C.id('fo')
    V.C.defs.append(f'<filter id="{oi}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="d"/>'
                    f'<feComposite in="d" in2="SourceAlpha" operator="out" result="o"/><feGaussianBlur in="o" stdDeviation=".6" result="b"/><feFlood flood-color="#2a6aa8" flood-opacity=".7"/><feComposite in2="b" operator="in"/></filter>')
    V.C.add(f'<path d="{tudo.d}" fill="#000" filter="url(#{oi})"/>')
    pinta(tudo, ('url', gi), blur=.8)
    for (x, y, r) in ((1700, 70, 16), (1840, 120, 20), (1790, 40, 11), (1610, 60, 12)):
        lin = []
        for k in range(3):
            a_ = math.radians(60*k + 15); lin.append(L([(x-r*math.cos(a_), y-r*math.sin(a_)), (x+r*math.cos(a_), y+r*math.sin(a_))], 3).d)
        pinta(Forma(' '.join(lin), [(x, y)], 3), '#7fc0e8')
camada('gelo_parede', 'Gelo na parede (teste)', gelo_parede)

# =============== ESTANTE ===============
def estante(x0, y0, x1, y1, nichos, prof=.08, cor='#e6eeff', cor2='#a9bfe8'):
    vx = S['VP'][0]; lado_dir = x1 < vx
    lado = [(x1, y0), fuga(x1, y0, prof), fuga(x1, y1, prof), (x1, y1)] if lado_dir else [(x0, y0), fuga(x0, y0, prof), fuga(x0, y1, prof), (x0, y1)]
    sombra(P([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]), 18, 14, .5, 22)
    poli(lado, hg(cor2, '#7189c8', min(p[0] for p in lado), max(p[0] for p in lado)), larg=3)
    pinta(R(x0, y0, x1, y1), hg(cor, cor2, x0, x1*1.4))
    for (a, b) in nichos:
        fx0, fx1 = x0+26, x1-26; A, B, Cc, D = (fx0, a), (fx1, a), (fx1, b), (fx0, b); k = .14
        A2, B2, C2, D2 = fuga(*A, k), fuga(*B, k), fuga(*Cc, k), fuga(*D, k); om = recorte(P([A, B, Cc, D]))
        pinta(P([A, B, Cc, D]), vg('#2a3f96', '#4664bd', a, b))
        pinta(P([A, B, B2, A2]), '#1b2c70', clip=om)
        if lado_dir: pinta(P([A, A2, D2, D]), hg('#22378a', '#3a57b0', fx0, A2[0]), clip=om)
        else: pinta(P([B, B2, C2, Cc]), hg('#3a57b0', '#22378a', B2[0], fx1), clip=om)
        pinta(P([A2, B2, C2, D2]), vg('#3654ad', '#5476cc', a, b), clip=om)
        pinta(P([D, Cc, C2, D2]), vg('#7d9ad8', '#a9c0ee', D2[1], b), clip=om)
        pinta(R(fx0, a, fx1, a+40), '#060b2e', .55, blur=12, clip=om)
        traco(R(fx0, a, fx1, b), larg=3)
    traco(R(x0, y0, x1, y1), larg=4); borda_luz(P(lado), '#ffffff', .45)
camada('estante', 'Estante', lambda: estante(-20, 75, 655, 920, [(105, 345), (370, 530), (555, 700), (725, 895)]))

NOMES = ['Boneco laranja', 'Boneco verde', 'Boneco azul', 'Boneco vermelho', 'Boneco rosa', 'Boneco amarelo']
def boneco(k):
    im = Image.open(f'bl{k}.png').convert('RGBA'); h = 166 if k == 3 else 150; w = im.width*h/im.height; cxk = 62 + k*101; base_y = 340
    pinta(E(cxk-w*.36, base_y-7, cxk+w*.36, base_y+5), '#060b2e', .55, blur=4)   # sombra de contato na prateleira
    imagem(im, cxk - w/2, base_y-h, w, h, sombra_=(12, -6, .55, 10))
for k in range(6): png_pronto(f'boneco{k}', NOMES[k])

# ---- gelo (o poder do Problems) ----
def prisma_gelo(bx, by, w, h, ang):
    a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    rot = lambda loc: [(bx + x*ca - y*sa, by + x*sa + y*ca) for x, y in loc]
    pts = rot([(-w/2, 0), (-w/2, -h + w*.7), (0, -h), (w/2, -h + w*.7), (w/2, 0)]); fm = P(pts)
    sombra(fm, 8, -2, .4, 6); ys = [p[1] for p in pts]; pinta(fm, vg('#f2fdff', '#6cc4f0', min(ys), max(ys)))
    pinta(P(rot([(-w*.12, 0), (-w*.12, -h + w*.7), (0, -h + 4), (w*.12, -h + w*.7), (w*.12, 0)])), '#ffffff', .55)
    traco(fm, '#1d4f8a', 2, .95)
def cristais():
    cx, base = 95, 528
    for dx, w, h, ang in ((-34, 20, 70, -24), (30, 18, 64, 22), (-14, 24, 104, -8), (12, 22, 92, 10), (0, 26, 122, 0)): prisma_gelo(cx + dx, base, w, h, ang)
    e = E(cx-48, base-10, cx+48, base+6); pinta(e, vg('#dff6ff', '#8fd3f2', base-10, base+6)); traco(e, '#1d4f8a', 2)
camada('cristais', 'Cristais de gelo', cristais)
def suporte(cx, base, larg=110):
    poli([(cx-6, base-60), (cx+6, base-60), (cx+8, base-14), (cx-8, base-14)], '#1a1e33', larg=2)
    poli([(cx-larg/2, base-14), (cx+larg/2, base-14), (cx+larg/2+6, base), (cx-larg/2-6, base)], vg('#2a2f4a', '#11142a', base-14, base), larg=2)
    pinta(R(cx-14, base-10, cx+14, base-6), '#e8ecf6')
def floco_gelo(cx, cy, r):
    lin = []; fino = []
    for k in range(6):
        a = math.radians(90 + 60*k); ex, ey = cx + r*math.cos(a), cy - r*math.sin(a); lin.append(L([(cx, cy), (ex, ey)], 7).d)
        for t in (.45, .72):
            px, py = cx + r*t*math.cos(a), cy - r*t*math.sin(a)
            for s_ in (-1, 1):
                b = a + s_*math.radians(45); Lr = r*(.32 if t < .6 else .22); fino.append(L([(px, py), (px + Lr*math.cos(b), py - Lr*math.sin(b))], 5).d)
    grosso = Forma(' '.join(lin), [(cx-r, cy-r), (cx+r, cy+r)], 7); fininho = Forma(' '.join(fino), [(cx-r, cy-r), (cx+r, cy+r)], 5); meio = E(cx-8, cy-8, cx+8, cy+8)
    for fm, l in ((grosso, 7), (fininho, 5)): pinta(fm, '#060b2e', .4, 6, tr='translate(8 -2)')
    for fm, l in ((grosso, 7+4), (fininho, 5+4)): pinta(Forma(fm.d, fm.pts, l), '#1d4f8a')       # contorno
    pinta(E(cx-12, cy-12, cx+12, cy+12), '#1d4f8a')
    g = vg('#ffffff', '#8fd6f5', cy-r, cy+r)
    for fm in (grosso, fininho): pinta(fm, g)
    pinta(meio, g)
def floco():
    suporte(255, 528, 90); floco_gelo(255, 462, 36)
    pinta(R(210, 420, 300, 518), '#ffffff', .12); traco(R(210, 420, 300, 518), '#cfe0ff', 3, .8)
camada('floco', 'Floco de gelo na cúpula', floco)

def caixa(x0, y0, x1, y1, prof, cor, cor_lado, cor_topo):
    a, b, c, d = (x0, y0), (x1, y0), (x1, y1), (x0, y1); a2, b2, c2, d2 = fuga(*a, prof), fuga(*b, prof), fuga(*c, prof), fuga(*d, prof)
    vx, vy = S['VP']; sombra(P([a, b, c, d]), 12, 6, .45, 9)
    if x1 < vx: poli([b, b2, c2, c], cor_lado, larg=2)
    if x0 > vx: poli([a, a2, d2, d], cor_lado, larg=2)
    if y0 > vy: poli([a, b, b2, a2], cor_topo, larg=2)
    pinta(R(x0, y0, x1, y1), vg(cor, cor_lado, y0, y1+60)); traco(R(x0, y0, x1, y1), larg=2)
    pinta(R(x0, y0, x1, y0+(y1-y0)*.18), vg(cor_topo, cor, y0, y0+(y1-y0)*.18)); traco(L([(x0, y0+(y1-y0)*.18), (x1, y0+(y1-y0)*.18)], 2), larg=2, alfa=.6)
    borda_luz(R(x0, y0, x1, y1), '#ffffff', .35)
def saturno(cx, cy, r, cor):
    pinta(E(cx-r, cy-r, cx+r, cy+r), cor)
    pinta(ELL_LINHA(cx-r*1.9, cy-r*.45, cx+r*1.9, cy+r*.45, max(3, int(r*.22))), cor)
    pinta(CHORD(cx-r, cy-r, cx+r, cy+r, 180, 360), cor)
def caixa_simbolo(x0, y0, x1, y1, cor, lado, topo, simb, cor_s='#cfe0ff'):
    caixa(x0, y0, x1, y1, .04, cor, lado, topo)
    pinta(RR((x0+x1)/2-(x1-x0)*.12, y0+(y1-y0)*.08, (x0+x1)/2+(x1-x0)*.12, y0+(y1-y0)*.14, 3), '#0d1440')
    cx, cy, r = (x0+x1)/2, y0+(y1-y0)*.6, (y1-y0)*.18
    if simb == 'saturno': saturno(cx, cy, r, cor_s)
    elif simb == 'lua': lua(cx, cy, r*1.3, cor_s, cor)
    elif simb == 'estrela': pinta(P(estrela_pts(cx, cy, r*1.4)), '#f2c94c' if cor_s == '#cfe0ff' else cor_s)
camada('caixa_saturno', 'Caixa Saturno (prateleira 2)', lambda: caixa_simbolo(440, 420, 620, 528, '#152a6a', '#0c1a48', '#22409a', 'saturno'))

def quadro_pe(x0, y0, x1, y1, arq, crop):
    m = R(x0, y0, x1, y1); sombra(m, 10, -3, .5, 8)
    pinta(m, vg('#1d2c6e', '#0f1a48', y0, y1)); traco(m, larg=3)
    pinta(R(x0+7, y0+7, x1-7, y1-7), hg('#f4f6ff', '#cdd6ee', x0, x1))
    pp = 15; im = Image.open(arq).convert('RGB').crop(crop); w, h = x1-x0-2*pp, y1-y0-2*pp
    im = ImageOps.fit(im, (round(w*3), round(h*3)), Image.LANCZOS)
    imagem(im, x0+pp, y0+pp, w, h, jpeg=True, escala=3)
    traco(R(x0+pp, y0+pp, x1-pp, y1-pp), larg=2)
    borda_luz(m, '#ffffff', .35)
camada('quadro_irma', 'Porta-retrato da irmã', lambda: quadro_pe(70, 572, 190, 698, 'irma.png', (420, 80, 1580, 1330)))
camada('quadro_amarelo', 'Porta-retrato da família', lambda: quadro_pe(212, 561, 322, 698, 'fim_limpo.png', (0, 0, 581, 774)))
camada('caixas3', 'Caixa da lua (prateleira 3)', lambda: caixa_simbolo(370, 590, 590, 700, '#e8ecf6', '#a9b6d6', '#f6f8ff', 'lua', '#2b55d0'))

def folha(cx, cy, ang, comp, larg, c0='#3d8a52', c1='#7fd08a', veia=True):
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux; pts = []
    for k in range(13): t = k/12; w = larg*math.sin(math.pi*t)**.8; pts.append((cx+ux*comp*t+nx*w, cy+uy*comp*t+ny*w))
    for k in range(12, -1, -1): t = k/12; w = larg*math.sin(math.pi*t)**.8; pts.append((cx+ux*comp*t-nx*w, cy+uy*comp*t-ny*w))
    fm = P(pts); xs = [p[0] for p in pts]
    pinta(fm, hg(c0, c1, min(xs), max(xs)+30) if ux >= 0 else hg(c1, c0, min(xs)-30, max(xs)))
    if veia: pinta(L([(cx, cy), (cx+ux*comp*.85, cy+uy*comp*.85)], 2), '#1f4a30', .5)
    traco(fm, '#0f2a24', 2, .85)
def vaso(cx, base, w, h, cor='#eef2ff'):
    pts = [(cx-w/2, base-h), (cx+w/2, base-h), (cx+w*.38, base), (cx-w*.38, base)]; fm = P(pts); sombra(fm, 10, -2, .45, 7)
    pinta(fm, hg(cor, '#8f9cc8', cx-w/2, cx+w*.7)); bo = RR(cx-w/2-4, base-h-10, cx+w/2+4, base-h+6, 4); pinta(bo, '#dfe5fa'); traco(fm, larg=2); traco(bo, larg=2)
def planta(cx, base, esc=1.0, vaso_cor='#eef2ff', tipo='folhas'):
    top = base - 58*esc
    if tipo == 'folhas':
        for ang, comp in ((-150, 90), (-120, 110), (-95, 120), (-70, 110), (-35, 95), (-170, 70), (-10, 70)): folha(cx, top+6, ang, comp*esc, 18*esc)
    else:
        for ang, comp in ((-140, 130), (-100, 150), (-60, 140), (-170, 100), (-20, 100)): folha(cx, top+6, ang, comp*esc, 44*esc)
    vaso(cx, base, 70*esc, 58*esc, vaso_cor)
def carta():
    x0, y0, x1, y1 = 232, 812, 370, 893
    m = R(x0, y0, x1, y1); sombra(m, 10, -3, .45, 7)
    pinta(m, vg('#fbf6ea', '#e2d8c2', y0, y1)); traco(m, larg=3)
    traco(L([(x0, y0), ((x0+x1)/2, y0+40), (x1, y0)], 2), larg=2, alfa=.7)
    traco(L([(x0, y1), ((x0+x1)/2, y0+46), (x1, y1)], 1), larg=1, alfa=.35)
    cx, cy = (x0+x1)/2, y0+42; e = E(cx-13, cy-13, cx+13, cy+13)
    pinta(e, vg('#9fe0ff', '#3f9ad8', cy-13, cy+13)); traco(e, '#1d4f8a', 2)
    for k in range(3):
        a_ = math.radians(60*k); pinta(L([(cx-8*math.cos(a_), cy-8*math.sin(a_)), (cx+8*math.cos(a_), cy+8*math.sin(a_))], 2), '#ffffff')
    texto('Para: Problems', cx, y1-14, 17, '#1d3a7a')
camada('carta', 'Carta para o Problems', carta)
def prat4():
    planta(150, 893, .8)
    # Terra em vetor (a foto de banco de imagens não vai para o repositório público)
    cx, cy, r = 455, 832, 36; m = E(cx-r, cy-r, cx+r, cy+r); pinta(m, vg('#4f9be8', '#173c95', cy-r, cy+r)); cl = recorte(m)
    pinta(junta(P([(cx-26, cy-22), (cx-6, cy-30), (cx+2, cy-14), (cx-10, cy-2), (cx-4, cy+12), (cx-14, cy+26), (cx-24, cy+4)]),
                P([(cx+8, cy-8), (cx+28, cy-14), (cx+34, cy+6), (cx+18, cy+22), (cx+10, cy+8)])), vg('#7fd08a', '#3d8a52', cy-30, cy+26), clip=cl)
    pinta(junta(E(cx-30, cy-34, cx+10, cy-24), E(cx+4, cy+20, cx+32, cy+28), E(cx-34, cy+8, cx-12, cy+14)), '#ffffff', .55, clip=cl)
    gi = V.C.id('g'); V.C.defs.append(f'<radialGradient id="{gi}" gradientUnits="userSpaceOnUse" cx="{f(cx-r*.35)}" cy="{f(cy-r*.4)}" r="{f(r*1.6)}">' + ''.join(f'<stop offset="{f(t)}" stop-color="#0a1440" stop-opacity="{f(.55*t**1.6)}"/>' for t in [i/8 for i in range(9)]) + '</radialGradient>')
    pinta(m, ('url', gi)); traco(m, '#0f1433', 2, .8)
    pinta(junta(CHORD(402, 770, 508, 890, 180, 360), R(402, 830, 508, 880)), '#ffffff', .1)
    pinta(Forma(ARC(402, 770, 508, 890, 180, 360, 3).d + ' ' + L([(402, 830), (402, 880)], 3).d + ' ' + L([(508, 830), (508, 880)], 3).d, [(402, 770), (508, 880)], 3), '#cfe0ff', .8)
    poli([(390, 880), (520, 880), (526, 893), (384, 893)], '#1a1e33', larg=2)
camada('prat4', 'Planta e globo (prateleira 4)', prat4)

# =============== LIVRO em cima da estante (desenhado já na posição final, ponto de fuga da estante) ===============
def livro():
    capa = Image.open('capa_foto.png').convert('RGB').crop((12, 25, 522, 765))
    VP = (903, 540); fg = lambda x, y, k: (x + (VP[0]-x)*k, y + (VP[1]-y)*k)
    H_, W_, k = 130, 90, .02; x0, base = 500, 210
    a, b, c, d = (x0, base-H_), (x0+W_, base-H_), (x0+W_, base), (x0, base)
    a2, b2, c2, d2 = fg(*a, k), fg(*b, k), fg(*c, k), fg(*d, k)
    sombra(P([a, b, c, d]), 12, 6, .5, 9)
    pinta(R(x0-4, base-5, x0+W_+30, base+3), '#060b2e', .55, blur=3)
    # páginas listradas do lado e topo
    lado = P([b, b2, c2, c])
    pinta(lado, '#e2e6f0')
    cl = recorte(lado); ls = []
    yy = min(b2[1], b[1])
    while yy < c[1] + 4: ls.append(L([(b[0]-2, yy), (b2[0]+4, yy)], 1.2).d); yy += 2.85
    pinta(Forma(' '.join(ls), [(0, 0)], 1.2), '#c9cedc', .8, clip=cl)
    pinta(P([a, b, b2, a2]), '#e9eef8')
    imagem(capa.resize((W_*3, H_*3), Image.LANCZOS), x0, base-H_, W_, H_, jpeg=True, escala=3)
    for q in ([a, b, c, d], [b, b2, c2, c], [a, b, b2, a2]): traco(P(q), '#0f1433', 1, .9)
camada('livro', 'Livro A Cor Escondida', livro)

# =============== QUADROS da parede ===============
def ceu_estrelado(a, b, c_, d, semente=5):
    rnd = random.Random(semente); pinta(R(a, b, c_, d), vg('#0a1440', '#071030', b, d)); pts = []
    for i in range(70):
        sx, sy = a + rnd.random()*(c_-a), b + rnd.random()*(d-b); r = .8 + rnd.random()*1.5; pts.append(E(sx-r, sy-r, sx+r, sy+r).d)
    pinta(Forma(' '.join(pts), [(a, b), (c_, d)]), '#dfe8ff', .9)
def moldura(x0, y0, x1, y1):
    sombra(R(x0, y0, x1, y1), 16, 18, .5, 16)
    pinta(R(x0, y0, x1, y1), '#12204f'); traco(R(x0, y0, x1, y1), larg=4)
    pinta(R(x0+14, y0+14, x1-14, y1-14), hg('#eef2ff', '#c8d2ec', x0, x1))
def quadro_planeta():
    x0, y0, x1, y1 = 700, 65, 1190, 555; moldura(x0, y0, x1, y1)
    a, b, c_, d = x0+34, y0+34, x1-34, y1-34; ceu_estrelado(a, b, c_, d)
    cx, cy = (a+c_)/2, (b+d)/2
    imagem(Image.open('planeta_azul.png').convert('RGBA'), cx-185, cy-185, 370, 370)
    traco(ELL_LINHA(cx-185, cy-185, cx+185, cy+185, 3), '#9fd0ff', 3, .7)
    traco(R(a, b, c_, d), larg=2, alfa=.7)
# camada('quadro_planeta', ...) — fica fora: usa uma foto de banco de imagens com marca d'água (trocar por uma livre antes)
def quadro_planeta2():
    x0, y0, x1, y1 = 700, 65, 1190, 555; moldura(x0, y0, x1, y1)
    a, b, c_, d = x0+34, y0+34, x1-34, y1-34; ceu_estrelado(a, b, c_, d)
    im = Image.open('terra2_rec.png').convert('RGBA'); lado = (c_-a)*.86; alt = lado*im.height/im.width
    imagem(im, (a+c_)/2 - lado/2, (b+d)/2 - alt/2, lado, alt, escala=1.6)
    traco(R(a, b, c_, d), larg=2, alfa=.7)
camada('quadro_planeta2', 'Quadro da Terra desenhada (teste)', quadro_planeta2, rot=2.5)

# =============== MÓVEL BAIXO + GLOBOS ===============
def movel():
    caixa(690, 735, 1730, 965, .035, '#e6eeff', '#9fb2e0', '#f4f8ff')
    for i in range(3):
        cx0 = 715 + i*340; fm = poli([(cx0, 790), (cx0+315, 790), (cx0+315, 945), (cx0, 945)], vg('#2a3f96', '#4664bd', 790, 945), larg=3)
        pinta(R(cx0, 790, cx0+315, 820), '#050a24', .6, blur=9, clip=recorte(R(cx0, 790, cx0+315, 945)))
camada('movel', 'Móvel baixo', movel)
def esfera(cx, cy, r, base, escura, desenho=(), contorno=True):
    m = E(cx-r, cy-r, cx+r, cy+r); sombra(m, 12, 10, .45, 10)
    pinta(m, vg(base, escura, cy-r, cy+r*1.2)); cl = recorte(m)
    for cor, fm in desenho: pinta(fm, cor, clip=cl)
    # volume: escurece longe do ponto de brilho (em cima à esquerda)
    gi = V.C.id('g'); hx_, hy_ = cx-r*.35, cy-r*.4
    st = ''.join(f'<stop offset="{f(t)}" stop-color="#0a1440" stop-opacity="{f(.55*t**1.6)}"/>' for t in [i/8 for i in range(9)])
    V.C.defs.append(f'<radialGradient id="{gi}" gradientUnits="userSpaceOnUse" cx="{f(hx_)}" cy="{f(hy_)}" r="{f(r*1.6)}">{st}</radialGradient>')
    pinta(m, ('url', gi))
    pinta(E(cx-r*.6, cy-r*.65, cx-r*.15, cy-r*.3), '#ffffff', .45, blur=r*.08)
    if contorno: traco(ELL_LINHA(cx-r, cy-r, cx+r, cy+r, 4), larg=4)
def movel_itens():
    caixa_simbolo(750, 830, 995, 943, '#2b5fd8', '#183a90', '#4a7ae6', 'saturno')
    suporte(1213, 943, 80); esfera(1213, 868, 46, '#d6dbe8', '#8a93ad', [('#9aa3bc', junta(E(1183, 843, 1208, 868), E(1223, 873, 1246, 894)))])
    caixa_simbolo(1430, 830, 1675, 943, '#2b5fd8', '#183a90', '#4a7ae6', 'estrela', '#e8ecf6')
camada('movel_itens', 'Caixas e lua do móvel', movel_itens)
def suporte_globo(cx, cy, r, base):
    pinta(E(cx-58, base-22, cx+58, base+4), vg('#2a2d3e', '#0e0f18', base-22, base+4))
    pinta(E(cx-50, base-24, cx+50, base-6), vg('#3a3e55', '#1a1c2a', base-24, base-6))
    traco(E(cx-58, base-22, cx+58, base+4), larg=2)
    ang = math.radians(-18); Rr = r + 13
    pt = lambda a: (cx + Rr*math.cos(math.radians(a) + ang), cy + Rr*math.sin(math.radians(a) + ang))
    arco = [pt(a) for a in range(80, 292, 4)]; pe = pt(80)
    poli([(cx-7, base-16), (cx+7, base-16), (pe[0]+6, pe[1]), (pe[0]-6, pe[1])], vg('#2a2d3e', '#11131f', pe[1], base), larg=2)
    m = L(arco, 13); sombra(m, 8, 6, .4, 6); pinta(m, '#14161f')
    pinta(L(arco[3:-3], 3), '#5a6080', .55)
    traco(L(arco, 2), larg=2, alfa=.6)
    for a in (80, 288): x, y = pt(a); pinta(E(x-6, y-6, x+6, y+6), '#2a2d3e')
base = 748; r = 58; cs = [770 + i*176 for i in range(6)]; cy = base-r-50; k_ = r/74
def faixa(cx, cy, r, y, alt, onda):
    pts = [(cx-r-5+k*(2*r+10)/30, y + math.sin(k*.7+onda)*alt*.35) for k in range(31)] + [(cx+r+5-k*(2*r+10)/30, y+alt + math.sin(k*.7+onda+1)*alt*.35) for k in range(31)]
    return P(pts)
PL = [
 ('planeta_laranja', 'Planeta laranja', '#ff8a1e', '#c4560a', lambda cx: [('#b8500c', E(cx-10*k_, cy-50*k_, cx+58*k_, cy+18*k_)), ('#d06a14', junta(E(cx-50*k_, cy+10*k_, cx-24*k_, cy+36*k_), E(cx+10*k_, cy+34*k_, cx+30*k_, cy+54*k_)))]),
 ('planeta_verde', 'Planeta verde', '#3fb85a', '#1f7a3a', lambda cx: [('#9be89a', junta(E(cx-60*k_, cy-40*k_, cx-5*k_, cy-5*k_), E(cx-20*k_, cy-60*k_, cx+40*k_, cy-20*k_), E(cx+5*k_, cy+10*k_, cx+70*k_, cy+50*k_), E(cx-50*k_, cy+30*k_, cx-10*k_, cy+60*k_)))]),
 ('planeta_azul_claro', 'Planeta azul', '#5fb6ff', '#2a78d6', lambda cx: [('#9fd6ff', faixa(cx, cy, r, cy-38, 10, 0)), ('#9fd6ff', faixa(cx, cy, r, cy-4, 13, 2)), ('#3f92e8', faixa(cx, cy, r, cy+26, 10, 4))]),
 ('planeta_vermelho', 'Planeta vermelho', '#e8343a', '#a01820', lambda cx: [('#8a1018', faixa(cx, cy, r, cy-46, 13, 1)), ('#ff6a6a', faixa(cx, cy, r, cy-8, 16, 3)), ('#8a1018', faixa(cx, cy, r, cy+32, 12, 5))]),
 ('planeta_rosa', 'Planeta roxo', '#9b4fe0', '#5f22a0', lambda cx: [('#c79bf2', faixa(cx, cy, r, cy-30, 12, 2)), ('#c79bf2', faixa(cx, cy, r, cy+18, 10, 4)), ('#d7b8f7', faixa(cx, cy, r, cy+40, 7, 1))]),
 ('planeta_amarelo', 'Planeta amarelo', '#ffe680', '#ffd95a', lambda cx: [('#d99a0c', P([(cx-r-6+k*(2*r+12)/30, cy+2+math.sin(k*.7+1)*4) for k in range(31)] + [(cx+r+6, cy+r+6), (cx-r-6, cy+r+6)]))]),
]
for i, (id_, nome, c1, c2, des) in enumerate(PL):
    camada(id_, nome, lambda cx=cs[i], c1=c1, c2=c2, des=des: (esfera(cx, cy, r, c1, c2, des(cx)), suporte_globo(cx, cy, r, base)))
camada('planta', 'Planta', lambda: planta(1790, 1012, 1.35, tipo='costela'))
def caixa_marrom():
    x0, y0, x1, y1, k = 1540, 905, 1730, 1010, .05
    A, B = (x0, y0), (x1, y0); A2, B2 = fuga(x0, y0, k), fuga(x1, y0, k)
    sombra(R(x0, y0, x1, y1), 12, 6, .45, 9)
    poli([A2, B2, (B2[0]+6, B2[1]-58), (A2[0]-6, A2[1]-58)], vg('#d9a86c', '#b8834e', A2[1]-58, A2[1]), larg=2)
    poli([A2, A, (A[0]-46, A[1]-26), (A2[0]-44, A2[1]-30)], hg('#b07c48', '#d09a62', A[0]-46, A[0]), larg=2)
    poli([B, B2, (B2[0]+44, B2[1]-30), (B[0]+46, B[1]-26)], hg('#d09a62', '#b07c48', B[0], B[0]+46), larg=2)
    poli([A, B, B2, A2], vg('#3a2414', '#5a3a22', A2[1], A[1]), larg=2)
    if x1 < S['VP'][0]: poli([B, B2, fuga(x1, y1, k), (x1, y1)], '#8a5a34', larg=2)
    poli([A, B, (x1, y1), (x0, y1)], vg('#c8925e', '#8a5a34', y0, y1+60), larg=3)
    poli([A, B, (B[0]+10, B[1]+34), (A[0]-10, A[1]+34)], vg('#e0ac74', '#c48a52', y0, y0+34), larg=2)
camada('caixa_marrom', 'Caixa marrom', caixa_marrom)

# =============== PRIMEIRO PLANO (desfocado) ===============
def mesa():
    yt, yb = 1000, 1040
    pinta(R(-10, yt, 1930, yb), vg('#c9d6f6', '#7f95d2', yt, yb)); pinta(R(-10, yb, 1930, 1090), vg('#4f68b8', '#1d2a6a', yb, 1080))
    traco(L([(0, yt), (1920, yt)], 4), larg=4); traco(L([(0, yb), (1920, yb)], 3), larg=3)
camada('mesa', 'Mesa (na frente)', mesa, blur=2.2)
def teclado():
    poli([(800, 1090), (1150, 1090), (1125, 1012), (825, 1012)], vg('#232b58', '#121636', 1012, 1080), larg=3)
    for i in range(1, 3): yy = 1012 + (1080-1012)*i/3; pinta(L([(830, yy), (1120, yy)], 2), '#5a6aa8', .5)
camada('teclado', 'Teclado', teclado, blur=2.2)
def caderno():
    q = [(820, 1092), (1130, 1092), (1108, 1010), (842, 1010)]
    poli([(816, 1096), (1134, 1096), (1134, 1102), (816, 1102)], '#e9eef8', larg=2)
    poli(q, vg('#7fc8f5', '#2f7ec4', 1010, 1092), larg=3)
    poli([(900, 1030), (1050, 1030), (1056, 1062), (894, 1062)], vg('#f4f9ff', '#d6e6f6', 1030, 1062), larg=2)
    texto('Problems', 975, 1046, 24, '#1d3a7a')
    for k in range(9):
        t = (k+.5)/9; x = 842 + (820-842)*t; y = 1010 + 82*t; pinta(ELL_LINHA(x-7, y-5, x+11, y+5, 3), '#c9d2e4')
camada('caderno', 'Caderno', caderno, blur=2.2)
def caneca():
    cx0, cy0, cx1, cy1 = 60, 830, 250, 1070
    corpo = junta(R(cx0, cy0+22, cx1, cy1-20), E(cx0, cy1-44, cx1, cy1)); sombra(corpo, 24, 10, .5, 18)
    ab = [cx1-75, cy0+55, cx1+65, cy0+(cy1-cy0)*.78]
    alca = ARC(ab[0]+14, ab[1]+14, ab[2]-14, ab[3]-14, -90, 90, 28)
    pinta(Forma(alca.d, alca.pts, 34, 'butt'), '#0f1433', .9)    # contorno da alça
    pinta(alca, '#3d5fc0')
    pinta(corpo, hg('#2b48a8', '#7ea6f2', cx0, cx1)); pinta(R(cx1-60, cy0+30, cx1-32, cy1-30), '#e6f2ff', .35, blur=8)
    pinta(E(cx0, cy0, cx1, cy0+46), vg('#a9c6f2', '#6a8fd6', cy0, cy0+46)); pinta(E(cx0+14, cy0+8, cx1-14, cy0+40), vg('#121a48', '#2b3d7a', cy0, cy0+40))
    sc, sx = (cy1-cy0)*.16, (cx0+cx1)/2
    pinta(P(estrela_pts(sx, (cy0+cy1)/2+8, sc)), vg('#ffe08a', '#e6a92e', cy0, cy1))
    contorno = Forma(L([(cx0, cy0+22), (cx0, cy1-22)], 4).d + ' ' + L([(cx1, cy0+22), (cx1, cy1-22)], 4).d + ' ' + ARC(cx0, cy1-44, cx1, cy1, 0, 180, 4).d + ' ' + E(cx0, cy0, cx1, cy0+46).d, [(cx0, cy0), (cx1, cy1)], 4)
    pinta(contorno, '#0f1433', .9)
camada('caneca', 'Caneca (na frente)', caneca, blur=2.2)

# =============== LUMI de teste: arte original (PNG) ===============
im = Image.open('site/camadas/lumi.png'); im.save(f'{OUT}/lumi.png', optimize=True); c = POS['lumi']
CAM.append({'id': 'lumi', 'nome': 'Lumi (teste)', 'arq': 'camadas/lumi.png', 'tipo': 'png', 'x': c['x'], 'y': c['y'], 'w': c['w'], 'h': c['h']})

# na ordem do camadas.json (de trás para a frente)
ordem = [c['id'] for c in BASE['camadas']]
CAM.sort(key=lambda c: ordem.index(c['id']))
json.dump({'w': W, 'h': H, 'camadas': CAM}, open('vetor/saida/base.json', 'w'), ensure_ascii=False, indent=1)
print(len(CAM), 'camadas')
