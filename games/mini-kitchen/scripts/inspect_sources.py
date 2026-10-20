from pathlib import Path
from PIL import Image, ImageDraw
import json, cv2
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'assets/sprites.json').read_text('utf-8'))
ids=[3,4,9,10,15,16,35,86,87,88,90,91,92,94,95,96,97,98,100,101,102,103,104]
sheet=Image.new('RGB',(1400,((len(ids)+3)//4)*250),'#888077')
d=ImageDraw.Draw(sheet)
for n,i in enumerate(ids):
    key=next(k for k in manifest if int(k.split('_')[0])==i)
    im=Image.open(root/manifest[key]['src']).convert('RGBA')
    bbox=im.getbbox()
    print(key,manifest[key]['box'],'alpha',bbox)
    im=im.crop(bbox)
    im.thumbnail((330,210))
    x=(n%4)*350;y=(n//4)*250
    sheet.paste(im,(x+(350-im.width)//2,y+30),im)
    d.text((x+5,y+5),key,fill='black')
sheet.save(root/'assets/source-audit.jpg')
for video in root.glob('assets/*.mp4'):
    cap=cv2.VideoCapture(str(video))
    fps=cap.get(cv2.CAP_PROP_FPS);frames=cap.get(cv2.CAP_PROP_FRAME_COUNT)
    print(video.name,'duration',frames/fps if fps else 0)
    if 'ultra' in video.name:
        sheet=Image.new('RGB',(1280,566*3))
        for n,t in enumerate([12,50,102]):
            cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
            ok,frame=cap.read()
            if ok:
                im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));im.thumbnail((1280,566))
                sheet.paste(im,(0,n*566))
        sheet.save(root/'assets/video-audit.jpg')
    cap.release()
