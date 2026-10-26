python3 vetor/camadas_svg.py >/dev/null && node vetor/rasteriza.js vetor/saida vetor/rast && python3 - <<'PY'
import numpy as np, json
from PIL import Image
j=json.load(open('vetor/saida/base.json'))
for c in j['camadas']:
    if c['tipo']!='svg': continue
    a=np.asarray(Image.open(f"site/camadas/{c['id']}.png").convert('RGBA')).astype(float)
    b=np.asarray(Image.open(f"vetor/rast/{c['id']}.png").convert('RGBA')).astype(float)
    m=(a[...,3]>200)&(b[...,3]>200)
    bg=np.array([90,110,170.]); A=a[...,:3]*a[...,3:]/255+bg*(1-a[...,3:]/255); B=b[...,:3]*b[...,3:]/255+bg*(1-b[...,3:]/255)
    d=np.abs(A-B).mean(2); mm=np.maximum(a[...,3],b[...,3])>10
    print(f"{c['id']:18s} R{(b[...,0]-a[...,0])[m].mean():+5.1f} G{(b[...,1]-a[...,1])[m].mean():+5.1f} B{(b[...,2]-a[...,2])[m].mean():+5.1f}  media {d[mm].mean():4.1f}")
PY
