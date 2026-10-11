import json, sys
from PIL import Image, ImageDraw, ImageFont
def render(occ_file, region, out, px=10, graph=None, labels=True):
    d = json.load(open(occ_file)); step = d['step']
    u0,u1,v0,v1 = region
    W = int((u1-u0)/step*px/ (1))  # we place by cell
    cw = px
    im = Image.new('RGB', (int((u1-u0)/step)*1+1, int((v1-v0)/step)+1), (20,20,30))
    img = Image.new('RGB', (int((u1-u0)/step*cw)+cw, int((v1-v0)/step*cw)+cw), (20,20,30))
    dr = ImageDraw.Draw(img)
    H = img.size[1]
    def xy(u, v): return (round((u-u0)/step)*cw, H - round((v-v0)/step)*cw - cw)
    for u,v,y,cb,cr,*_ in d["cells"]:
        if u<u0 or u>u1 or v<v0 or v>v1: continue
        x,yy = xy(u,v)
        if y is None: col=(30,60,110)
        else:
            g = int(90 + max(-0.3,min(1.5,y))*60)
            col=(g,g,g-10)
            if y < 0.0: col=(50,90,140)
            if cb < 0: col=(220,40,40)
            elif cb < 0.08: col=(240,140,40)
            elif cb < 0.2: col=(230,210,80)
            elif cr is not None and cr < 0: col=(200,60,200)
            elif cr is not None and cr < 0.1: col=(150,110,190)
        dr.rectangle([x,yy,x+cw-1,yy+cw-1], fill=col)
    if graph:
        g = json.load(open(graph)); nodes = {n['id']:n for n in g['nodes']}
        font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 13) if True else None
        for e in g['edges']:
            pts = [(nodes[e['a']]['u'], nodes[e['a']]['v'])] + [(q[0],q[1]) for q in e.get('via',[])] + [(nodes[e['b']]['u'], nodes[e['b']]['v'])]
            pp = [(xy(a,b)[0]+cw/2, xy(a,b)[1]+cw/2) for a,b in pts]
            dr.line(pp, fill=(60,255,120), width=2)
            for a,b in pts[1:-1]:
                x,yy = xy(a,b); dr.ellipse([x+cw/2-3,yy+cw/2-3,x+cw/2+3,yy+cw/2+3], outline=(0,255,255))
        for n in g['nodes']:
            x,yy = xy(n['u'], n['v']); dr.ellipse([x+cw/2-5,yy+cw/2-5,x+cw/2+5,yy+cw/2+5], fill=(255,255,0), outline=(0,0,0))
            if labels: dr.text((x+8,yy-6), n['id'], fill=(255,255,255), font=font)
    # grid ticks every 1 unit
    font2 = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 11)
    import math
    for uu in range(math.ceil(u0), int(u1)+1):
        x,_ = xy(uu, v0); dr.line([x+cw/2,H-8,x+cw/2,H], fill=(255,255,255)); 
        if uu%2==0: dr.text((x+cw/2-6,H-22), str(uu), fill=(255,255,255), font=font2)
    for vv in range(math.ceil(v0), int(v1)+1):
        _,y2 = xy(u0, vv); dr.line([0,y2+cw/2,8,y2+cw/2], fill=(255,255,255))
        if vv%2==0: dr.text((10,y2+cw/2-6), str(vv), fill=(255,255,255), font=font2)
    img.save(out)
if __name__ == '__main__':
    occ, u0,u1,v0,v1, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
    graph = sys.argv[7] if len(sys.argv) > 7 else None
    px = int(sys.argv[8]) if len(sys.argv) > 8 else 10
    render(occ, (u0,u1,v0,v1), out, px, graph)
