"""Identify visible components without changing PSD artwork or layer placement."""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,json
root=Path(__file__).resolve().parents[1]
path=root/'assets/sprites.json'
assets=json.loads(path.read_text('utf-8'))
for key,a in assets.items():
    im=Image.open(root/a['src']).convert('RGBA')
    alpha=np.asarray(im)[:,:,3]
    _,_,stats,_=cv2.connectedComponentsWithStats((alpha>32).astype('uint8'))
    if int(key.split('_')[0]) in [35,94]:
        stat=max(stats[1:],key=lambda s:s[4]);x,y,w,h=map(int,stat[:4])
        x0=max(0,x-4);y0=max(0,y-4);x1=min(im.width,x+w+4);y1=min(im.height,y+h+4)
        a['contentBox']=[x0,y0,x1-x0,y1-y0]
    else:
        y,x=np.where(alpha>32)
        a['contentBox']=[int(x.min()),int(y.min()),int(x.max()-x.min()+1),int(y.max()-y.min()+1)]
    if int(key.split('_')[0]) in [21,22,23,57,58,59,76,82,83]:
        # Normalize order thumbnails around the solid dish, excluding floating steam.
        rgb=np.asarray(im)[:,:,:3]
        # Opaque shadows are part of the exported PNG too. Center the lit dish body,
        # while retaining the original surrounding pixels when drawing the icon.
        body=((alpha>180)&(rgb.max(axis=2)>110)).astype('uint8')
        _,_,solid,_=cv2.connectedComponentsWithStats(body)
        bx,by,bw,bh=map(int,max(solid[1:],key=lambda s:s[4])[:4])
        _,_,opaque,_=cv2.connectedComponentsWithStats((alpha>8).astype('uint8'))
        x,y,w,h=map(int,max(opaque[1:],key=lambda s:s[4])[:4]);pad=max(4,int(w*.025))
        x0=max(0,x-pad);y0=max(0,y-pad);x1=min(im.width,x+w+pad);y1=min(im.height,y+h+pad)
        a['iconBox']=[x0,y0,x1-x0,y1-y0]
        a['iconCenter']=[bx+bw/2,by+bh/2]
path.write_text(json.dumps(assets,ensure_ascii=False,indent=2),'utf-8')
print('Prepared visible bounds for',len(assets),'PSD layers')
