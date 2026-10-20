from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
layers={int(k.split('_')[0]):v for k,v in json.loads((root/'assets/sprites.json').read_text('utf-8')).items()}
out=root/'assets/guide';out.mkdir(exist_ok=True)
for i in [2,3,20,21,22,23,35,36,37,40,56,57,58,59,70,71,72,73,79,85,90,94]:
    a=layers[i];x,y,w,h=a['contentBox'];im=Image.open(root/a['src']).convert('RGBA').crop((x,y,x+w,y+h));im.thumbnail((180,180));im.save(out/f'{i}.webp',lossless=True)
print('Prepared original-art guide thumbnails.')
