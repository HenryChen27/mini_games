from pathlib import Path
import cv2
from PIL import Image, ImageDraw

out=Path('test-results/reference');out.mkdir(parents=True,exist_ok=True)
video=cv2.VideoCapture('assets/hd.mp4')
def frame(t):
    video.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok,bgr=video.read()
    return Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)) if ok else None

times=[0,2,4,6,8,10,12,15,20,30,60,95]
sheet=Image.new('RGB',(1280,4*330),'#302a28')
for i,t in enumerate(times):
    im=frame(t)
    if im is None:continue
    im.save(out/f'full-{t}.jpg')
    im.thumbnail((426,300));x=(i%3)*426;y=(i//3)*330
    sheet.paste(im,(x,y));ImageDraw.Draw(sheet).text((x+8,y+300),f'{t}s',fill='white')
sheet.save(out/'contact.jpg')
video.release()
