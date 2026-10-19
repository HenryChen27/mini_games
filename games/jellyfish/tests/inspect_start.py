import cv2
from PIL import Image, ImageDraw
c=cv2.VideoCapture('start.mp4')
sheet=Image.new('RGB',(1600,1200));d=ImageDraw.Draw(sheet)
for i,t in enumerate([0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.8]):
    c.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok,f=c.read()
    if ok:
        im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));im.thumbnail((400,270))
        x=i%4*400;y=i//4*400
        sheet.paste(im,(x,y));d.text((x,y+280),str(t),fill='white')
sheet.save('tests/start-contact.png')
