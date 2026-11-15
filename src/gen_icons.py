import cairosvg, os
from PIL import Image
T="#0D9488"
OUT="/workspace/engcalc-deploy"
def glyph(scale=1.0):
    # S-N curve glyph: axes + curve with upper plateau, sloped line, endurance plateau
    g=f'''<g transform="translate(512 512) scale({scale}) translate(-512 -512)" fill="none" stroke="{T}" stroke-linecap="round" stroke-linejoin="round">
<path d="M244 232V772H792" stroke-width="64"/>
<path d="M340 340H430L632 614H752" stroke-width="80"/>
</g>'''
    return g
def svg(rounded=True, scale=1.0, bg=True):
    rect=f'<rect width="1024" height="1024" {"rx=\"228\"" if rounded else ""} fill="#ffffff"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{rect}{glyph(scale)}</svg>'
open(f"{OUT}/icon.svg","w").write(svg(True))
open("icon-square.svg","w").write(svg(False))
open("icon-maskable.svg","w").write(svg(False,0.72))
def png(svgtext,size,path):
    cairosvg.svg2png(bytestring=svgtext.encode(),write_to=path,output_width=size,output_height=size)
png(svg(True),32,f"{OUT}/favicon-32.png")
png(svg(False),180,f"{OUT}/apple-touch-icon.png")
png(svg(True),192,f"{OUT}/icon-192.png")
png(svg(True),512,f"{OUT}/icon-512.png")
png(svg(False,0.72),192,f"{OUT}/icon-maskable-192.png")
png(svg(False,0.72),512,f"{OUT}/icon-maskable-512.png")
# preview: rounded 512, maskable with safe-zone circle, favicon x4, on dark and light
png(svg(True),512,"p_main.png")
prev=Image.new("RGB",(1400,470),"#0b0b0c")
light=Image.new("RGB",(700,470),"#f7f7f5"); prev.paste(light,(700,0))
m=Image.open("p_main.png").convert("RGBA").resize((360,360)); prev.paste(m,(40,40),m)
mk=Image.open(f"{OUT}/icon-maskable-512.png").convert("RGBA").resize((240,240))
from PIL import ImageDraw
mask=Image.new("L",(240,240),0); ImageDraw.Draw(mask).ellipse((0,0,239,239),fill=255)
prev.paste(mk,(430,60),mask)
f=Image.open(f"{OUT}/favicon-32.png").convert("RGBA"); prev.paste(f,(430,340),f); prev.paste(f.resize((64,64),Image.NEAREST),(480,320),f.resize((64,64),Image.NEAREST))
m2=Image.open(f"{OUT}/icon-192.png").convert("RGBA"); prev.paste(m2,(760,40),m2)
a=Image.open(f"{OUT}/apple-touch-icon.png").convert("RGBA"); prev.paste(a,(980,46),a)
s24=Image.open("p_main.png").convert("RGBA").resize((48,48),Image.LANCZOS); prev.paste(s24,(760,300),s24)
d=ImageDraw.Draw(prev)
d.text((40,420),"icon.svg (rounded, rx=228)",fill="#b4b4b8"); d.text((430,310),"maskable (circle crop)",fill="#b4b4b8"); d.text((430,410),"favicon-32 (1x, 2x)",fill="#b4b4b8")
d.text((760,250),"icon-192 / apple-touch-icon 180 (square)",fill="#52525b")
prev.save("/workspace/engcalc-icon/preview.png"); prev.save(f"{OUT}/../engcalc-shots/icon-preview.png")
print("ok")
