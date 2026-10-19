from pathlib import Path
import cv2
from PIL import Image, ImageDraw

capture = cv2.VideoCapture(str(next(Path('.').glob('*.mp4'))))
fps = capture.get(cv2.CAP_PROP_FPS)
duration = capture.get(cv2.CAP_PROP_FRAME_COUNT) / fps
print('Duration:', duration, 'FPS:', fps)
sheet = Image.new('RGB', (1500, 1050))
draw = ImageDraw.Draw(sheet)
for index, time in enumerate([0, 1, 2, 3, 4, 5, 6, 8, 9.5]):
    capture.set(cv2.CAP_PROP_POS_MSEC, time * 1000)
    ok, frame = capture.read()
    if not ok:
        continue
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    image.thumbnail((500, 320))
    x, y = index % 3 * 500, index // 3 * 350
    sheet.paste(image, (x, y))
    draw.text((x, y + 325), str(time), fill='white')
sheet.save('tests/video-contact.png')
