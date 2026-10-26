import sys
from PIL import Image
for id_ in sys.argv[1:]:
    a=Image.open(f"site/camadas/{id_}.png").convert('RGBA'); b=Image.open(f"vetor/rast/{id_}.png").convert('RGBA')
    t=Image.new('RGBA',(a.width*2+10,a.height),(90,110,170,255)); t.alpha_composite(a,(0,0)); t.alpha_composite(b,(a.width+10,0))
    k=min(3, 1000/t.width); t=t.resize((int(t.width*k),int(t.height*k)),Image.LANCZOS); t.convert('RGB').save(f'/home/claude/planetario/cmp_{id_}.png')
