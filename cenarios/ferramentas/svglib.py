# Estilo "pintado azul com profundidade" em VETOR (SVG).
# As mesmas formas do lib.py (que pintava pixels com numpy), mas cada coisa sai como um elemento SVG:
# preenchimento chapado ou degradê, contorno escuro fino, sombra projetada borrada (filtro), brilho na borda (filtro),
# e a LUZ AMBIENTE da cena por cima de cada camada (multiplicar + vinheta + brilho ciano), recortada no desenho da camada.
# Fotos (bonecos, capa do livro, porta-retratos, desenho da Terra) entram como <image> embutida — o resto é vetor.
import math, base64, io
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

W, H = 1920, 1080
S = {'VP': (1000, 470)}

def f(v): return ('%.2f' % v).rstrip('0').rstrip('.')
def hx(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def hexd(c): return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)

class Camada:
    """Uma camada = um SVG. Desenho em coordenadas do cenário 'de origem' (como no lib.py)."""
    def __init__(self):
        self.defs = []; self.el = []; self.n = 0
    def id(self, p='d'): self.n += 1; return f'{p}{self.n}'
    def add(self, s): self.el.append(s)

C = None
def nova():
    global C; C = Camada(); _filtros.clear(); return C

# ---------- formas (devolvem o "d" de um path + pontos para centro/caixa) ----------
class Forma:
    def __init__(self, d, pts, linha=0, cap='round'): self.d, self.pts, self.linha, self.cap = d, pts, linha, cap
    def caixa(self):
        xs = [p[0] for p in self.pts]; ys = [p[1] for p in self.pts]; return min(xs), min(ys), max(xs), max(ys)
def R(x0, y0, x1, y1): return Forma(f'M{f(x0)} {f(y0)}H{f(x1)}V{f(y1)}H{f(x0)}Z', [(x0, y0), (x1, y1)])
def RR(x0, y0, x1, y1, r):
    r = max(0, min(r, (x1-x0)/2, (y1-y0)/2))
    d = (f'M{f(x0+r)} {f(y0)}H{f(x1-r)}A{f(r)} {f(r)} 0 0 1 {f(x1)} {f(y0+r)}V{f(y1-r)}A{f(r)} {f(r)} 0 0 1 {f(x1-r)} {f(y1)}'
         f'H{f(x0+r)}A{f(r)} {f(r)} 0 0 1 {f(x0)} {f(y1-r)}V{f(y0+r)}A{f(r)} {f(r)} 0 0 1 {f(x0+r)} {f(y0)}Z')
    return Forma(d, [(x0, y0), (x1, y1)])
def P(pts): pts = [tuple(p) for p in pts]; return Forma('M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts) + 'Z', pts)
def E(x0, y0, x1, y1):
    cx, cy, rx, ry = (x0+x1)/2, (y0+y1)/2, abs(x1-x0)/2, abs(y1-y0)/2
    return Forma(f'M{f(cx-rx)} {f(cy)}A{f(rx)} {f(ry)} 0 1 0 {f(cx+rx)} {f(cy)}A{f(rx)} {f(ry)} 0 1 0 {f(cx-rx)} {f(cy)}Z', [(x0, y0), (x1, y1)])
def L(pts, larg, cap='round'):  # linha aberta (vira traço da largura dada)
    pts = [tuple(p) for p in pts]; return Forma('M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts), pts, larg, cap)
def arco_pts(x0, y0, x1, y1, a0, a1, n=40):
    cx, cy, rx, ry = (x0+x1)/2, (y0+y1)/2, (x1-x0)/2, (y1-y0)/2
    return [(cx + rx*math.cos(math.radians(a0 + (a1-a0)*k/n)), cy + ry*math.sin(math.radians(a0 + (a1-a0)*k/n))) for k in range(n+1)]
def ARC(x0, y0, x1, y1, a0, a1, larg): return L(arco_pts(x0, y0, x1, y1, a0, a1), larg, 'butt')
def CHORD(x0, y0, x1, y1, a0, a1): return P(arco_pts(x0, y0, x1, y1, a0, a1))
def ELL_LINHA(x0, y0, x1, y1, larg):
    e = E(x0, y0, x1, y1); e.linha = larg; return e
def RET_LINHA(x0, y0, x1, y1, larg, r=0):
    e = RR(x0, y0, x1, y1, r) if r else R(x0, y0, x1, y1); e.linha = larg; return e
def POL_LINHA(pts, larg): e = P(pts); e.linha = larg; e.cap = 'round'; return e
def junta(*fs):
    pts = []; [pts.extend(x.pts) for x in fs]; fm = Forma(' '.join(x.d for x in fs), pts, fs[0].linha, fs[0].cap); return fm

# ---------- cores e degradês ----------
def vg(c0, c1, y0, y1): return ('v', c0, c1, y0, y1)
def hg(c0, c1, x0, x1): return ('h', c0, c1, x0, x1)
def tinta(cor):
    """cor chapada ('#..'), ('v'/'h', ...) ou ('url', id) → valor de fill"""
    if isinstance(cor, str): return cor
    if cor[0] == 'url': return f'url(#{cor[1]})'
    t, c0, c1, a, b = cor; i = C.id('g')
    if a == b: b = a + 1
    x1, y1, x2, y2 = (0, a, 0, b) if t == 'v' else (a, 0, b, 0)
    C.defs.append(f'<linearGradient id="{i}" gradientUnits="userSpaceOnUse" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}">'
                  f'<stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></linearGradient>')
    return f'url(#{i})'

# ---------- filtros reaproveitados ----------
_filtros = {}
def filtro_blur(s):
    k = ('b', round(s, 2))
    if k not in _filtros:
        i = C.id('fb'); _filtros[k] = i
        C.defs.append(f'<filter id="{i}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="{f(s)}"/></filter>')
    return _filtros[k]
def filtro_borda(cor, forca, dx, dy):
    k = ('r', cor, round(forca, 2), dx, dy)
    if k not in _filtros:
        i = C.id('fr'); _filtros[k] = i
        C.defs.append(f'<filter id="{i}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">'
                      f'<feOffset in="SourceAlpha" dx="{dx}" dy="{dy}" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="e"/>'
                      f'<feGaussianBlur in="e" stdDeviation="1.4" result="b"/><feFlood flood-color="{cor}" flood-opacity="{f(min(1, forca))}"/>'
                      f'<feComposite in2="b" operator="in"/></filter>')
    return _filtros[k]

def _attrs(op=1, blur=0, clip=None, tr=None):
    a = ''
    if op < 1: a += f' opacity="{f(op)}"'
    if blur: a += f' filter="url(#{filtro_blur(blur)})"'
    if clip: a += f' clip-path="url(#{clip})"'
    if tr: a += f' transform="{tr}"'
    return a
def el(fm, cor, op=1, blur=0, clip=None, tr=None):
    t = tinta(cor)
    if fm.linha:
        return f'<path d="{fm.d}" fill="none" stroke="{t}" stroke-width="{f(fm.linha)}" stroke-linecap="{fm.cap}" stroke-linejoin="round"{_attrs(op, blur, clip, tr)}/>'
    return f'<path d="{fm.d}" fill="{t}"{_attrs(op, blur, clip, tr)}/>'
def pinta(fm, cor, op=1, blur=0, clip=None, tr=None): C.add(el(fm, cor, op, blur, clip, tr))
def recorte(fm):
    i = C.id('c'); C.defs.append(f'<clipPath id="{i}"><path d="{fm.d}"/></clipPath>'); return i

# lib.py: sombra(m, dx, dy, forca, blur) = a forma deslocada, borrada, escura por baixo
def sombra(fm, dx=14, dy=16, forca=.45, blur=14, cor='#060b2e', clip=None):
    pinta(fm, cor, forca, blur, clip, f'translate({f(dx)} {f(dy)})')
def borda_luz(fm, cor='#dff0ff', forca=.5, dx=-5, dy=5):
    C.add(f'<path d="{fm.d}" fill="#000" filter="url(#{filtro_borda(cor, forca, dx, dy)})"/>')
def traco(fm, cor='#0f1433', larg=3, alfa=.9):
    fm2 = Forma(fm.d, fm.pts, larg or fm.linha, fm.cap); pinta(fm2, cor, alfa)
def poli(pts, cor, larg=3, sh=None, luz=False):
    fm = P(pts)
    if sh: sombra(fm, *sh)
    pinta(fm, cor)
    if luz: borda_luz(fm)
    if larg: traco(fm, larg=larg)
    return fm

def fuga(x, y, k): vx, vy = S['VP']; return (x + (vx-x)*k, y + (vy-y)*k)
def estrela_pts(cx, cy, r, ri=.45, rot=-90):
    return [(cx + (r if i % 2 == 0 else r*ri)*math.cos(math.radians(rot+36*i)), cy + (r if i % 2 == 0 else r*ri)*math.sin(math.radians(rot+36*i))) for i in range(10)]
def lua(cx, cy, r, cor, fundo):
    # lua crescente: o círculo menos o "corte" (vira um path com recorte par/ímpar, sem pintar a cor de fundo)
    i = C.id('m')
    C.defs.append(f'<mask id="{i}" maskUnits="userSpaceOnUse" x="{f(cx-r*2)}" y="{f(cy-r*2)}" width="{f(r*4)}" height="{f(r*4)}">'
                  f'<path d="{E(cx-r,cy-r,cx+r,cy+r).d}" fill="#fff"/><path d="{E(cx-r*.55,cy-r*1.1,cx+r*1.25,cy+r*.7).d}" fill="#000"/></mask>')
    C.add(f'<path d="{E(cx-r,cy-r,cx+r,cy+r).d}" fill="{tinta(cor)}" mask="url(#{i})"/>')

# ---------- imagens (fotos) embutidas ----------
def img_data(im, jpeg=False, q=90):
    b = io.BytesIO()
    if jpeg: im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True); mt = 'image/jpeg'
    else: im.save(b, 'PNG', optimize=True); mt = 'image/png'
    return f'data:{mt};base64,' + base64.b64encode(b.getvalue()).decode()
def imagem(im, x, y, w, h, jpeg=False, sombra_=None, escala=2):
    """foto no lugar (w×h na cena). Guarda em até 2× o tamanho de tela, para o zoom ficar bom."""
    ww, hh = max(1, round(w*escala)), max(1, round(h*escala))
    if im.width > ww or im.height > hh: im = im.resize((min(im.width, ww), min(im.height, hh)), Image.LANCZOS)
    i = C.id('im'); href = img_data(im, jpeg)
    if sombra_:
        dx, dy, forca, blur = sombra_
        C.defs.append(f'<filter id="{i}s" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="{f(blur)}"/>'
                      f'<feOffset dx="{f(dx)}" dy="{f(dy)}"/><feComponentTransfer><feFuncA type="linear" slope="{f(forca)}"/></feComponentTransfer>'
                      f'<feColorMatrix type="matrix" values="0 0 0 0 0.024  0 0 0 0 0.043  0 0 0 0 0.18  0 0 0 1 0"/></filter>')
        C.add(f'<use href="#{i}" filter="url(#{i}s)"/>')
    C.defs.append(f'<image id="{i}" href="{href}" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" preserveAspectRatio="none"/>')
    C.add(f'<use href="#{i}"/>')

# ---------- texto virando contorno (o SVG dentro de <img> não carrega fontes de fora) ----------
_fontes = {}
def texto(txt, cx, cy, tam, cor, fonte='fontes/caveat.ttf'):
    if fonte not in _fontes: _fontes[fonte] = TTFont(fonte)
    fo = _fontes[fonte]; gs = fo.getGlyphSet(); cmap = fo.getBestCmap(); upm = fo['head'].unitsPerEm; k = tam/upm
    asc = fo['hhea'].ascent; desc = fo['hhea'].descent
    x = 0; partes = []
    for ch in txt:
        g = cmap.get(ord(ch));
        if not g: continue
        pen = SVGPathPen(gs); tp = TransformPen(pen, (k, 0, 0, -k, x, 0)); gs[g].draw(tp); partes.append(pen.getCommands()); x += gs[g].width*k
    # centro vertical pela altura das letras minúsculas/maiúsculas (aproximado como o textbbox do PIL)
    capH = (fo['OS/2'].sCapHeight if hasattr(fo['OS/2'], 'sCapHeight') and fo['OS/2'].sCapHeight else asc*.7)*k
    tx, ty = cx - x/2, cy + capH/2
    C.add(f'<path d="{" ".join(partes)}" fill="{tinta(cor)}" transform="translate({f(tx)} {f(ty)})"/>')

# ---------- a LUZ AMBIENTE da cena (mesma conta do camadas.py), por cima do desenho da camada ----------
# luz(x,y) = .62 + .34*(.6 x/W + .5 (1 - y/H))   (multiplica)
# vinheta = 1 - .4*min(1, ((x-1056)/1440)² + ((y-486)/918)²)   (multiplica)
# brilho ciano = exp(-((x-1600)/900)² - ((y-40)/520)²) * #9fe8ff * .08   (soma)
# tinta azul nos escuros: rgb*.95 + #2a3fb0*.1*(1-lum)   (matriz de cor)
def luz_ambiente(mapa, caixa):
    """filtro da luz da cena para esta camada: multiplica pelo degradê de luz × vinheta (feImage de um SVG pequeno,
    feComposite aritmético = multiplicar sem halo nas bordas meio transparentes) e põe a tinta azul nos escuros.
    mapa(x,y) → (xf,yf): de onde o desenho está para onde a camada fica na cena. caixa = viewBox (x,y,w,h) de origem."""
    vx, vy, vw, vh = caixa; a = mapa(0, 0); b = mapa(1, 0); c = mapa(0, 1)
    sx, sy = b[0]-a[0], c[1]-a[1]
    inv = lambda X, Y: ((X-a[0])/sx, (Y-a[1])/sy)
    gx, gy = .34*.6/W*sx, -.34*.5/H*sy; n = math.hypot(gx, gy); ux, uy = gx/n, gy/n
    cx, cy = vx + vw/2, vy + vh/2; D = math.hypot(vw, vh)/2 + 2
    p1, p2 = (cx - ux*D, cy - uy*D), (cx + ux*D, cy + uy*D)
    def lz(p): X, Y = mapa(*p); return max(.6, min(1, .62 + .34*(.6*X/W + .5*(1 - Y/H))))
    cinza = lambda v: hexd((255*min(1, v),)*3)
    (vcx, vcy) = inv(1056, 486); vrx, vry = 1440/sx, 918/sy
    st = ''.join(f'<stop offset="{f(t)}" stop-color="{cinza(1 - .4*t*t)}"/>' for t in [i/8 for i in range(9)])
    mini = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{f(vw)}" height="{f(vh)}" viewBox="{f(vx)} {f(vy)} {f(vw)} {f(vh)}" preserveAspectRatio="none"><defs>'
            f'<linearGradient id="a" gradientUnits="userSpaceOnUse" x1="{f(p1[0])}" y1="{f(p1[1])}" x2="{f(p2[0])}" y2="{f(p2[1])}"><stop offset="0" stop-color="{cinza(lz(p1))}"/><stop offset="1" stop-color="{cinza(lz(p2))}"/></linearGradient>'
            f'<radialGradient id="b" gradientUnits="userSpaceOnUse" cx="{f(vcx)}" cy="{f(vcy)}" r="{f(vrx)}" gradientTransform="translate({f(vcx)} {f(vcy)}) scale(1 {f(vry/vrx)}) translate({f(-vcx)} {f(-vcy)})">{st}</radialGradient></defs>'
            f'<rect x="{f(vx)}" y="{f(vy)}" width="{f(vw)}" height="{f(vh)}" fill="url(#a)"/><rect x="{f(vx)}" y="{f(vy)}" width="{f(vw)}" height="{f(vh)}" fill="url(#b)" style="mix-blend-mode:multiply"/></svg>')
    href = 'data:image/svg+xml;base64,' + base64.b64encode(mini.encode()).decode()
    # brilho ciano do canto de cima à direita (soma): outro SVG pequeno, preto onde não brilha
    (gcx, gcy) = inv(1600, 40); grx, gry = 900/sx, 520/sy
    stg = ''.join(f'<stop offset="{f(t)}" stop-color="{hexd(tuple(v*.08*math.exp(-(t*2.5)**2) for v in hx("#9fe8ff")))}"/>' for t in [i/10 for i in range(11)])
    mini2 = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{f(vw)}" height="{f(vh)}" viewBox="{f(vx)} {f(vy)} {f(vw)} {f(vh)}" preserveAspectRatio="none"><defs>'
             f'<radialGradient id="c" gradientUnits="userSpaceOnUse" cx="{f(gcx)}" cy="{f(gcy)}" r="{f(grx*2.5)}" gradientTransform="translate({f(gcx)} {f(gcy)}) scale(1 {f(gry/grx)}) translate({f(-gcx)} {f(-gcy)})">{stg}</radialGradient></defs>'
             f'<rect x="{f(vx)}" y="{f(vy)}" width="{f(vw)}" height="{f(vh)}" fill="url(#c)"/></svg>')
    href2 = 'data:image/svg+xml;base64,' + base64.b64encode(mini2.encode()).decode()
    bc = [v/255 for v in hx('#2a3fb0')]; tb = .1
    # (rgb já dividido por 2 na soma) → ×2 aqui, junto com a tinta azul nos escuros
    lin = lambda i: ' '.join(f(2*(.95*(i == j) - tb*bc[i]/3)) for j in range(3)) + f' 0 {f(tb*bc[i])}'
    i = C.id('luz')
    C.defs.append(f'<filter id="{i}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="{f(vx)}" y="{f(vy)}" width="{f(vw)}" height="{f(vh)}" color-interpolation-filters="sRGB">'
                  f'<feImage href="{href}" x="{f(vx)}" y="{f(vy)}" width="{f(vw)}" height="{f(vh)}" preserveAspectRatio="none" result="L"/>'
                  f'<feImage href="{href2}" x="{f(vx)}" y="{f(vy)}" width="{f(vw)}" height="{f(vh)}" preserveAspectRatio="none" result="G"/>'
                  f'<feComposite in="SourceGraphic" in2="L" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="M"/>'
                  f'<feComposite in="G" in2="SourceAlpha" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="Gi"/>'
                  f'<feComposite in="M" in2="Gi" operator="arithmetic" k1="0" k2=".5" k3=".5" k4="0" result="S"/>'
                  f'<feColorMatrix in="S" type="matrix" values="{lin(0)}  {lin(1)}  {lin(2)}  0 0 0 1 0"/></filter>')
    return i

def svg(caixa, w, h, mapa, rot=0, blur=0, luz=True):
    """monta o SVG da camada: caixa = viewBox de origem (x,y,w,h); w,h = tamanho em pixels na cena."""
    vx, vy, vw, vh = caixa
    corpo = ''.join(C.el)
    if rot:  # quadro tortinho: gira em volta do meio
        cx, cy = vx + vw/2, vy + vh/2; corpo = f'<g transform="rotate({f(rot)} {f(cx)} {f(cy)})">{corpo}</g>'
    if blur: corpo = f'<g filter="url(#{filtro_blur(blur)})">{corpo}</g>'
    if luz: corpo = f'<g filter="url(#{luz_ambiente(mapa, caixa)})">{corpo}</g>' 
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" '
            f'viewBox="{f(vx)} {f(vy)} {f(vw)} {f(vh)}" data-cenario="planetario">'
            f'<defs>{"".join(C.defs)}</defs>{corpo}</svg>')
