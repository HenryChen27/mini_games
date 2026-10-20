"""Decode supplied alpha MOVs and calibrate each dish against all native cookware.

Uses existing PyAV/Pillow/OpenCV. Keeps alpha, frame timing and original MOVs.
Runtime uses a lossless WebP atlas, avoiding browser-specific MOV support.
"""
from pathlib import Path
import hashlib
import json
import av
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/effects/runtime'
OUT.mkdir(parents=True, exist_ok=True)
sprites = json.loads((ROOT / 'assets/sprites.json').read_text('utf-8'))
layers = {int(k.split('_')[0]): v for k, v in sprites.items()}
DISHES = {'carrot_soup': ([2,8,14], [5,11,17]),
          'corn_soup': ([2,8,14], [6,12,18]),
          'tomato_beef': ([35,42,49], [38,45,52]),
          'potato_beef': ([35,42,49], [39,46,53])}


def component_box(rgba):
    # Loose specks/shadows must not shift the visual anchor (notably potato MOV).
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (rgba[:,:,3] >= 96).astype(np.uint8), 8)
    if count < 2:
        raise ValueError('Missing cookware alpha mask')
    x,y,w,h,_ = stats[1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])]
    return [int(x),int(y),int(w),int(h)]


def target_box(layer_id):
    layer = layers[layer_id]
    rgba = np.asarray(Image.open(ROOT / layer['src']).convert('RGBA'))
    x,y,w,h = component_box(rgba)
    return [x + layer['box'][0], y + layer['box'][1], w, h]


manifest = {'version': 1, 'format': 'lossless RGBA WebP frame atlas', 'dishes': {}}
for dish, (empty_ids, finished_ids) in DISHES.items():
    path = ROOT / 'assets/effects' / (dish + '.mov')
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        fps = float(stream.average_rate)
        frames = [frame.to_ndarray(format='rgba') for frame in container.decode(video=0)]
    first_box, last_box = component_box(frames[0]), component_box(frames[-1])
    # Remove only disconnected tiny artifacts, preserve real falling ingredients
    # and every anti-aliased edge of their components.
    cleaned = []
    for rgba in frames:
        count, labels, stats, _ = cv2.connectedComponentsWithStats(
            (rgba[:,:,3] > 0).astype(np.uint8), 8)
        for label in range(1, count):
            if stats[label, cv2.CC_STAT_AREA] < 12:
                rgba[labels == label] = 0
        rgba[rgba[:,:,3] == 0, :3] = 0
        cleaned.append(Image.fromarray(rgba))
    boxes = [im.getbbox() for im in cleaned]
    crop = (max(0,min(b[0] for b in boxes)-2), max(0,min(b[1] for b in boxes)-2),
            min(frames[0].shape[1],max(b[2] for b in boxes)+2),
            min(frames[0].shape[0],max(b[3] for b in boxes)+2))
    width, height = crop[2]-crop[0], crop[3]-crop[1]
    atlas = Image.new('RGBA', (width*6, height*((len(frames)+5)//6)))
    rects = []
    for j, image in enumerate(cleaned):
        x,y = j%6*width, j//6*height
        atlas.paste(image.crop(crop), (x,y))
        rects.append([x,y,width,height])
    atlas.save(OUT / (dish+'.webp'), lossless=True, method=6)
    targets = {}
    for index, (empty_id, finished_id) in enumerate(zip(empty_ids, finished_ids)):
        targets[str(index if 'soup' in dish else index+3)] = {
            'first': target_box(empty_id), 'last': target_box(finished_id)}
    manifest['dishes'][dish] = {'src': 'assets/effects/runtime/'+dish+'.webp',
        'source': str(path.relative_to(ROOT)).replace('\\','/'),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'fps': fps, 'duration': len(frames)/fps, 'frames': rects,
        'crop': list(crop), 'firstAnchor': first_box, 'lastAnchor': last_box,
        'targets': targets}
    print(dish, len(frames), 'frames;', crop, 'anchors:', first_box, last_box)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2), 'utf-8')
