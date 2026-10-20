"""Small reusable painterly FX atlases and cutouts from the supplied PSD exports.
No generation service or new third-party artwork is used.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/fx'
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(227)

def bezier(a, b, c, d, steps=16):
    return [tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k] for k in range(2)) for t in np.linspace(0, 1, steps)]

atlas = Image.new('RGBA', (256*8, 144))
for frame in range(8):
    phase=frame*np.pi/4
    frame_im=Image.new('RGBA',(256,144))
    for level, color in enumerate([(211,91,33,175),(238,136,46,205),(250,184,73,220),(255,218,126,180)]):
        wash=Image.new('RGBA',(256,144)); brush=ImageDraw.Draw(wash)
        # A shallow elliptical burner, rather than a straight row of flame icons.
        ring=[]
        for angle in np.linspace(0,2*np.pi,100):
            ring.append((128+(113-level*2)*np.cos(angle),99+(23-level*2)*np.sin(angle)+np.sin(angle*7+phase)*1.6))
        brush.polygon(ring,fill=color)
        brush.ellipse((34+level,80+level,222-level,108-level),fill=(0,0,0,0))
        for j in range(17):
            angle=j*np.pi/16;x=128+110*np.cos(angle)
            base=99+22*np.sin(angle)
            sway=np.sin(phase+j*1.7)*4
            height=(14+11*np.sin(j*2.1+phase))*(1-level*.14)
            width=10-level*1.3
            tip=(x+sway,base-height)
            outline=bezier((x-width,base),(x-width,base-height*.12),(x+sway+width*.5,base-height*.65),tip)
            outline+=bezier(tip,(x+sway+width*.2,base-height*.7),(x+width*.9,base-height*.25),(x+width,base))
            brush.polygon(outline,fill=color)
        # Uneven pigment and short pastel flecks, baked once rather than per frame.
        pixels=np.asarray(wash).copy(); grain=rng.uniform(.68,1.07,(144,256))
        pixels[:,:,3]=(pixels[:,:,3]*grain).clip(0,255).astype('uint8')
        pigment=rng.normal(0,4,(144,256))
        for channel in range(3):pixels[:,:,channel]=(pixels[:,:,channel]+pigment).clip(0,255).astype('uint8')
        wash=Image.fromarray(pixels).filter(ImageFilter.GaussianBlur(.7 if level else 1.4))
        frame_im=Image.alpha_composite(frame_im,wash)
    atlas.alpha_composite(frame_im,(frame*256,0))
atlas.save(OUT/'flame_atlas.png',optimize=True)

steam=Image.new('RGBA',(128*4,192))
for variant in range(4):
    mask=Image.new('L',(128,192)); brush=ImageDraw.Draw(mask)
    for strand in range(3):
        for j in range(34):
            u=j/33; x=58+strand*9+np.sin(u*8+variant+strand*.8)*(5+u*13)
            y=178-u*155; radius=3+u*9
            alpha=int(18*np.sin(np.pi*u)**.8)
            brush.ellipse((x-radius,y-radius*.9,x+radius,y+radius*.9),fill=alpha)
    mask=mask.filter(ImageFilter.GaussianBlur(3))
    wisp=Image.new('RGBA',(128,192),(255,245,218,0));wisp.putalpha(mask)
    steam.alpha_composite(wisp,(variant*128,0))
steam.save(OUT/'steam_atlas.png',optimize=True)

water=np.zeros((96,192,4),dtype='uint8')
yy,xx=np.mgrid[:96,:192];r=((xx-96)/95)**2+((yy-48)/47)**2
grain=rng.normal(0,1.8,(96,192))
for channel,base in enumerate([137,191,196]):
    water[:,:,channel]=(base+yy*.09+grain).clip(0,255)
water[:,:,3]=(np.clip((1-r)*22,0,1)*248).astype('uint8')
Image.fromarray(water).save(OUT/'water.png',optimize=True)

cutouts={
    'corn':('006_corn_soup',[(218,70),(244,57),(283,58),(310,77),(323,104),(310,136),(281,150),(243,144),(219,120),(213,94)]),
    'carrot':('005_carrot_soup',[(139,125),(157,123),(174,134),(180,153),(172,172),(150,179),(133,167),(130,145)]),
    'tomato':('038_tomato_beef',[(282,159),(310,142),(343,146),(367,168),(378,199),(365,228),(338,246),(304,245),(281,225),(269,196)]),
    'potato':('039_potato_beef',[(266,195),(296,191),(320,204),(324,230),(311,263),(286,286),(263,293),(242,275),(235,250),(245,217)]),
}
for name,(source,points) in cutouts.items():
    im=Image.open(ROOT/f'assets/sprites/{source}.png').convert('RGBA')
    mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(points,fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(.7))
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel('A')),np.asarray(mask))))
    im=im.crop(mask.getbbox());im.save(OUT/f'{name}.png',optimize=True)
print('Prepared 2 reusable FX atlases and 4 PSD ingredient cutouts')
