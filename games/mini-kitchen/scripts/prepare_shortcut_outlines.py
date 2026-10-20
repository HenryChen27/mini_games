"""Trace the actual alpha silhouettes of clickable PSD assets in world coordinates."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[1]
layers={int(k.split('_')[0]):v for k,v in json.loads((root/'assets/sprites.json').read_text('utf-8')).items()}
groups={**{f'pot:{i}':[n] for i,n in enumerate([2,8,14,35,42,49])},
        **{f'storage:{i}':[n] for i,n in enumerate([20,25,30,56,61,66])},
        'ingredient:corn':[72],'ingredient:carrot':[73],'ingredient:potato':[71],
        'ingredient:tomato':[70],'ingredient:water':[85],'ingredient:raw_beef':[78,79],
        'instant:rice':[83],'instant:bread':[81,82],'instant:candy':[75,76],'help:help':[103]}
out={}
for key,ids in groups.items():
    boxes=[]
    for n in ids:
        a=layers[n];x,y,w,h=a['contentBox'];boxes.append((a['box'][0]+x,a['box'][1]+y,w,h))
    left=min(b[0] for b in boxes)-12;top=min(b[1] for b in boxes)-12
    right=max(b[0]+b[2] for b in boxes)+12;bottom=max(b[1]+b[3] for b in boxes)+12
    mask=np.zeros((bottom-top,right-left),np.uint8)
    for n,(x,y,w,h) in zip(ids,boxes):
        a=layers[n];sx,sy,_,_=a['contentBox'];alpha=np.asarray(Image.open(root/a['src']).convert('RGBA'))[sy:sy+h,sx:sx+w,3]
        pixels=np.asarray(Image.open(root/a['src']).convert('RGBA'))[sy:sy+h,sx:sx+w]
        solid=alpha>=110
        if n in [20,25,30,83]:solid &= pixels[:,:,:3].mean(axis=2)>120
        patch=mask[y-top:y-top+h,x-left:x-left+w];np.maximum(patch,solid.astype(np.uint8)*255,out=patch)
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    count,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
    large=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]));mask=(labels==large).astype(np.uint8)*255
    mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    points=cv2.approxPolyDP(max(contours,key=cv2.contourArea),1.5,True).reshape(-1,2)
    points=points+np.array([left,top]);x,y,w,h=cv2.boundingRect(points.astype(np.int32))
    out[key]={'points':points.tolist(),'bounds':[x,y,w,h]}
(root/'assets/fx/shortcut-outlines.json').write_text(json.dumps(out,separators=(',',':')),'utf-8')
print('Traced',len(out),'clickable silhouettes.')
