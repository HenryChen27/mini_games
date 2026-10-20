"""Pack actual image-model outputs into runtime atlases, preserving their alpha.
Only isolated export specks and atlas layout are processed; no procedural food,
flame or steam artwork is substituted for the generated pictures.
"""
from pathlib import Path
from PIL import Image
import cv2,json,numpy as np

root=Path(__file__).resolve().parents[1];out=root/'assets/fx/generated'

def tiles(name,cols,rows):
    im=Image.open(out/name).convert('RGBA');result=[]
    for j in range(rows):
        for i in range(cols):
            tile=im.crop((round(i*im.width/cols),round(j*im.height/rows),round((i+1)*im.width/cols),round((j+1)*im.height/rows)))
            pixels=np.asarray(tile).copy();alpha=pixels[:,:,3]
            count,labels,stats,_=cv2.connectedComponentsWithStats((alpha>24).astype('uint8'))
            largest=max(stats[1:,4]);valid=[k for k in range(1,count) if stats[k,4]>=max(12,largest*.004)]
            mask=np.isin(labels,valid).astype('uint8')
            mask=cv2.dilate(mask,np.ones((5,5),'uint8'))
            pixels[:,:,3]*=mask
            clean=Image.fromarray(pixels);bounds=clean.getchannel('A').getbbox()
            result.append(clean.crop(bounds))
    return result

def pack(items,name,width=1024):
    positions=[];x=y=row=0
    for im in items:
        if x+im.width+4>width:x=0;y+=row+4;row=0
        positions.append([x,y,im.width,im.height]);x+=im.width+4;row=max(row,im.height)
    atlas=Image.new('RGBA',(width,y+row))
    for im,rect in zip(items,positions):atlas.paste(im,tuple(rect[:2]))
    atlas.save(out/name,optimize=True)
    return {'src':'assets/fx/generated/'+name,'rects':positions}

food=tiles('ingredients-v1.png',4,4)
for im in food:im.thumbnail((192,192),Image.Resampling.LANCZOS)
ingredients=pack(food,'ingredients-runtime-v1.png')

thermal=tiles('thermal-v1.png',4,4);frames=[]
for n,im in enumerate(thermal):
    # Keep the center/base anchor fixed to avoid generated framing jitter.
    frame=Image.new('RGBA',(256,192));im=im.copy()
    im.thumbnail((230,130) if n<8 else (125,176),Image.Resampling.LANCZOS)
    frame.paste(im,((256-im.width)//2,(166 if n<8 else 184)-im.height))
    frames.append(frame)
heat=pack(frames,'thermal-runtime-v1.png')

bases=tiles('bases-v1.png',2,2)
for im in bases:im.thumbnail((384,224),Image.Resampling.LANCZOS)
base=pack(bases,'bases-runtime-v1.png')
mapping={
 'corn_soup':{'pepper_back':1,'corn':0,'kernel_left':2,'kernel_small':2,'pepper_front':3,'kernel_front':2},
 'carrot_soup':{'leek':7,'carrot_back':5,'pea_back':6,'pea_right':6,'carrot_left':4,'carrot_right':4,'pea_front':6},
 'tomato_beef':{'onion_back':9,'onion_front':10,'tomato':8,'garnish':11},
 'potato_beef':{'potato_back':13,'potato_left':13,'potato_small':13,'potato_front':12,'scallion':14},
}
manifest={'version':1,'provenance':'Built-in image_gen, 3 generated RGBA source sheets; transparent alpha preserved.',
 'ingredients':ingredients,'thermal':heat,'bases':base,'baseIndex':{name:i for i,name in enumerate(mapping)},'mapping':mapping,
 'sources':['ingredients-v1.png','thermal-v1.png','bases-v1.png']}
(out/'manifest-v1.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
print('Packed model-generated ingredient atlas, 8 flame/8 steam frames, and four clean dish bases.')
