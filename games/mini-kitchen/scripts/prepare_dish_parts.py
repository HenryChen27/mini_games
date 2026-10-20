"""Lossless dish decomposition: original ingredient pixels + inpainted surface.

At rest the independently placed pieces reconstruct the supplied PSD frame exactly.
The cleaned surface only appears in the small areas uncovered by moving ingredients.
"""
from pathlib import Path
import json, math
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/fx';OUT.mkdir(exist_ok=True)
layers={int(k.split('_')[0]):v for k,v in json.loads((ROOT/'assets/sprites.json').read_text('utf-8')).items()}

def oval(x,y,rx,ry):
    return [(x+rx*math.cos(a*math.pi/12),y+ry*math.sin(a*math.pi/12)) for a in range(24)]

# Polygons follow the visible ingredient edges in each canonical PSD dish.
# Duplicate pot variants use the same normalized coordinates, sampled from their
# own original pixels (no stretching of the ingredient artwork at runtime).
recipes={
 'corn_soup':{'ids':[6,12,18],'size':[441,376],'parts':[
  ('pepper_back',[(135,82),(149,78),(159,88),(172,112),(167,128),(151,128),(141,112)]),
  ('corn',[(220,72),(241,60),(265,57),(291,64),(310,80),(323,104),(315,128),(298,144),(273,152),(245,146),(224,131),(215,110),(214,91)]),
  ('kernel_left',oval(166,140,16,15)),
  ('kernel_small',oval(139,158,8,8)),
  ('pepper_front',[(254,174),(269,161),(282,153),(300,148),(294,164),(278,178),(263,186),(253,182)]),
  ('kernel_front',oval(169,184,9,7)),
 ]},
 'carrot_soup':{'ids':[5,11,17],'size':[441,377],'parts':[
  ('leek',[(123,70),(134,66),(142,82),(151,91),(155,74),(164,78),(160,105),(157,128),(146,125),(139,104),(131,89)]),
  ('carrot_back',[(182,80),(195,74),(211,77),(223,92),(230,111),(228,133),(213,137),(200,132),(193,112)]),
  ('pea_back',oval(245,106,10,12)),
  ('pea_right',oval(310,124,11,11)),
  ('carrot_left',[(139,131),(153,124),(169,128),(181,141),(185,160),(176,176),(156,182),(140,176),(131,160),(132,143)]),
  ('carrot_right',[(255,141),(274,135),(298,141),(313,157),(320,173),(303,185),(280,193),(261,182),(245,165),(246,151)]),
  ('pea_front',oval(228,193,8,7)),
 ]},
 'soup':{'ids':[3,9,15],'size':[441,376],'parts':[
  ('red_back',oval(151,114,13,15)),('orange_back',oval(242,116,11,14)),
  ('herb',oval(222,137,13,12)),('red_left',oval(156,164,9,10)),
  ('red_front',oval(250,177,17,16)),('orange_right',oval(289,178,11,9)),
  ('small_left',oval(194,186,10,9)),
 ]},
 'cooking':{'ids':[4,10,16],'size':[441,376],'parts':[
  ('leek',[(179,68),(190,67),(200,82),(199,111),(188,131),(171,127),(174,99)]),
  ('pepper_back',[(208,91),(222,85),(240,93),(245,110),(238,126),(218,139),(207,126)]),
  ('carrot',[(141,91),(155,91),(161,108),(158,136),(149,153),(139,145),(138,116)]),
  ('tomato',[(253,99),(272,95),(288,106),(297,124),(298,146),(289,158),(267,162),(246,153),(240,136),(243,115)]),
  ('carrot_front',[(139,151),(153,151),(158,165),(162,184),(155,194),(139,192),(130,177)]),
  ('pepper_front',[(220,155),(231,150),(241,158),(242,173),(228,192),(216,195),(212,182)]),
 ]},
 'tomato_beef':{'ids':[38,45,52],'size':[496,351],'parts':[
  ('onion_back',[(65,92),(89,78),(112,81),(133,95),(137,119),(123,143),(110,160),(95,182),(77,173),(60,158),(51,135),(53,110)]),
  ('onion_front',[(48,176),(64,180),(80,194),(103,199),(111,215),(100,230),(77,230),(57,219),(46,199)]),
  ('tomato',[(279,143),(305,131),(333,132),(356,144),(375,165),(386,194),(381,221),(365,248),(339,266),(309,275),(287,273),(269,258),(254,234),(254,206),(261,178)]),
  ('garnish',[(190,259),(213,244),(236,244),(256,256),(251,275),(224,285),(201,281),(183,275)]),
 ]},
 'potato_beef':{'ids':[39,46,53],'size':[509,370],'parts':[
  ('potato_back',[(206,107),(229,99),(248,108),(259,127),(257,148),(243,155),(220,147),(206,130)]),
  ('potato_left',[(48,158),(63,150),(77,159),(74,181),(57,198),(40,194),(34,180)]),
  ('potato_small',[(125,232),(145,222),(163,224),(170,238),(158,258),(142,269),(121,267),(112,253)]),
  ('potato_front',[(266,195),(292,190),(315,198),(328,213),(325,237),(315,258),(295,280),(273,293),(252,285),(238,267),(236,244),(246,219)]),
  ('scallion',oval(230,167,8,9)),
 ]},
}

manifest={};total=0
for dish,recipe in recipes.items():
 for layer_id in recipe['ids']:
    source=Image.open(ROOT/layers[layer_id]['src']).convert('RGBA')
    pixels=np.asarray(source);w,h=source.size;rw,rh=recipe['size']
    occupied=np.zeros((h,w),dtype='uint8');pieces=[]
    for index,(name,points) in enumerate(recipe['parts']):
        mask=Image.new('L',(w,h));ImageDraw.Draw(mask).polygon([(round(x*w/rw),round(y*h/rh)) for x,y in points],fill=255)
        core=cv2.dilate(np.asarray(mask),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
        margin=max(3,round(6*w/rw))
        binary=cv2.dilate(core,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(margin*2+1,margin*2+1)))
        binary[(occupied>0)|(pixels[:,:,3]!=255)]=0;core=np.minimum(core,binary)
        occupied=np.maximum(occupied,binary)
        bbox=Image.fromarray(binary).getbbox()
        if not bbox:continue
        part=pixels.copy();part[:,:,3]=binary
        image=Image.fromarray(part).crop(bbox);part[:,:,3]=core
        flight=Image.fromarray(part).crop(bbox)
        pieces.append({'name':name,'image':image,'flight':flight,'box':[bbox[0],bbox[1],bbox[2]-bbox[0],bbox[3]-bbox[1]],
                       'amplitude':(.55 if layer_id>=35 else (3.2 if name=='corn' else 2.25))*w/rw,
                       'phase':round(index*1.71,4),'delay':round(index*.052,4),
                       'fallDuration':round(.48+index%3*.035,4)})
    rgb=cv2.inpaint(pixels[:,:,:3].copy(),occupied,7,cv2.INPAINT_TELEA)
    clean=pixels.copy();clean[:,:,:3]=rgb
    cleaned=Image.fromarray(clean)
    # Binary, nonoverlapping ingredient masks guarantee the exact original end frame.
    rebuilt=cleaned.copy()
    for piece in pieces:rebuilt.alpha_composite(piece['image'],tuple(piece['box'][:2]))
    if not np.array_equal(np.asarray(rebuilt),pixels):raise AssertionError(f'Non-exact assembly: {layer_id}')
    x0,y0,x1,y1=Image.fromarray(occupied).getbbox();patch_box=[max(0,x0-2),max(0,y0-2),min(w,x1+2),min(h,y1+2)]
    patch=cleaned.crop(patch_box)
    # Pack the cleaned patch and all tiny pieces into one small atlas per PSD layer.
    tiles=[patch]+[tile for p in pieces for tile in [p['image'],p['flight']]];placements=[];x=y=row=0
    for tile in tiles:
        if x+tile.width+2>512:x=0;y+=row+2;row=0
        placements.append([x,y,tile.width,tile.height]);x+=tile.width+2;row=max(row,tile.height)
    atlas=Image.new('RGBA',(512,y+row))
    for tile,rect in zip(tiles,placements):atlas.paste(tile,tuple(rect[:2]))
    src=f'assets/fx/dish_{layer_id}.png';atlas.save(ROOT/src,optimize=True)
    for j,piece in enumerate(pieces):
        del piece['image'];del piece['flight'];piece['rect']=placements[1+j*2];piece['flightRect']=placements[2+j*2]
    manifest[str(layer_id)]={'dish':dish,'src':src,'size':[w,h],
                            'patch':{'box':[patch_box[0],patch_box[1],patch.width,patch.height],'rect':placements[0]},'parts':pieces}
    total+=len(pieces)
(OUT/'dish-parts.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
print(f'Prepared {total} exact-frame ingredient parts across {len(manifest)} PSD dish variants')
